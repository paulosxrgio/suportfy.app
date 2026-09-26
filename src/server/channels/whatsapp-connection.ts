import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { withSystem, withTenant, type Db, type Tx } from "../db/tx";
import { AppError } from "../errors";
import { assertSafeUrl, UnsafeUrlError, type HttpRequester, type SafeRequestOptions } from "../net/safe-request";
import { deleteSecret, readSecretForServerUse, setSecret, type SecretKeyring } from "../secrets/service";
import { requireRole, requireStore } from "../tenancy/context";
import { createEvolutionClient, type EvolutionCallResult, type EvolutionState } from "./evolution";

/*
 * Conectar, testar e desconectar a instância da Evolution API de uma loja.
 * O canal só vira "connected" quando o provedor aceita a chave, confirma que a
 * instância está aberta no WhatsApp e o webhook assinado foi registrado.
 * Nenhuma dessas operações envia mensagem a clientes.
 */

export interface ConnectionDeps {
  db: Db;
  keyring: SecretKeyring;
  request: HttpRequester;
  /** Endereço público do app, para registrar o webhook. */
  publicUrl: string | undefined;
  urlOptions?: SafeRequestOptions;
  now?: () => Date;
}

export const connectInputSchema = z.object({
  storeId: z.string().uuid(),
  baseUrl: z.string().trim().min(1, "Informe o endereço da Evolution API.").max(300),
  instance: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]{1,64}$/, "Nome da instância: letras, números, ponto, hífen ou sublinhado (até 64)."),
  apiKey: z.string().trim().min(16, "A chave da Evolution API parece curta demais.").max(300),
  /** Número do WhatsApp da loja (opcional): evita responder às próprias mensagens. */
  address: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || /^\d{8,15}$/.test(v), "Número inválido: use DDI + DDD + número.")
    .optional(),
});

export type ConnectInput = z.input<typeof connectInputSchema>;

export interface WhatsAppChannelView {
  channelId: string;
  status: "disconnected" | "pending" | "connected" | "error";
  providerState: EvolutionState | null;
  instance: string | null;
  /** Só o host do endereço, para exibição. */
  host: string | null;
  address: string | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  apiKeyLast4: string | null;
}

export function webhookUrl(publicUrl: string, channelId: string): string {
  return `${publicUrl.replace(/\/+$/, "")}/api/webhooks/whatsapp/${channelId}`;
}

async function loadChannelForStore(tx: Tx, storeId: string) {
  const { rows } = await tx.query<{ id: string; org_id: string }>("SELECT id, org_id FROM channels WHERE store_id = $1 AND kind = 'whatsapp'", [storeId]);
  if (!rows[0]) throw new AppError("not_found", "Canal de WhatsApp não encontrado.");
  return rows[0];
}

/** Mensagem segura (sem dados sensíveis) para cada falha do provedor. */
function describeFailure(result: Extract<EvolutionCallResult<unknown>, { ok: false }>, step: "state" | "webhook"): string {
  switch (result.kind) {
    case "unauthorized":
      return "A Evolution API recusou a chave de acesso.";
    case "not_found":
      return step === "state" ? "Instância não encontrada nesta Evolution API." : "Não foi possível registrar o webhook: instância não encontrada.";
    case "unsafe_url":
      return "O endereço da Evolution API aponta para uma rede interna e foi bloqueado.";
    case "network":
      return "Não foi possível falar com a Evolution API (rede ou tempo esgotado).";
    default:
      return `A Evolution API respondeu com erro${result.status ? ` ${result.status}` : ""}.`;
  }
}

const NOT_OPEN_MESSAGE = "A instância não está conectada ao WhatsApp. Leia o QR code no painel da Evolution API e teste de novo.";

async function updateChannel(
  db: Db,
  channelId: string,
  patch: { status: WhatsAppChannelView["status"]; providerState?: EvolutionState | null; lastError: string | null; checkedAt: Date },
) {
  await withSystem(db, (tx) =>
    tx.query(
      `UPDATE channels SET status = $2, provider_state = coalesce($3, provider_state), last_error = $4, last_checked_at = $5, updated_at = now()
       WHERE id = $1`,
      [channelId, patch.status, patch.providerState ?? null, patch.lastError, patch.checkedAt],
    ),
  );
}

export async function connectWhatsApp(deps: ConnectionDeps, userId: string, input: ConnectInput): Promise<WhatsAppChannelView> {
  const parsed = connectInputSchema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid_input", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const data = parsed.data;
  const now = deps.now?.() ?? new Date();

  const { channel, orgId } = await withTenant(deps.db, userId, async (tx) => {
    const store = await requireStore(tx, data.storeId);
    await requireRole(tx, store.orgId, "admin");
    return { channel: await loadChannelForStore(tx, data.storeId), orgId: store.orgId };
  });

  let url: URL;
  try {
    url = assertSafeUrl(data.baseUrl, deps.urlOptions);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new AppError("invalid_input", error.message);
    throw error;
  }
  if (!deps.publicUrl) {
    throw new AppError("not_configured", "O servidor não tem SUPORTFY_PUBLIC_URL definido; sem ele a Evolution API não sabe para onde enviar as mensagens.");
  }
  const baseUrl = `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  const webhookKey = randomBytes(32).toString("base64url");

  await setSecret(deps.db, deps.keyring, userId, { orgId, storeId: data.storeId, kind: "evolution_api_key", value: data.apiKey });
  await setSecret(deps.db, deps.keyring, userId, { orgId, storeId: data.storeId, kind: "evolution_webhook_key", value: webhookKey });
  await withSystem(deps.db, (tx) =>
    tx.query(
      `UPDATE channels SET config = $2, address = coalesce(nullif($3, ''), address), status = 'pending', provider_state = NULL,
         last_error = NULL, updated_at = now() WHERE id = $1`,
      [channel.id, JSON.stringify({ baseUrl, instance: data.instance }), data.address ?? ""],
    ),
  );

  const client = createEvolutionClient({ baseUrl, instance: data.instance, apiKey: data.apiKey }, deps.request);
  const state = await client.connectionState();
  if (!state.ok) {
    await updateChannel(deps.db, channel.id, { status: "error", lastError: describeFailure(state, "state"), checkedAt: now });
  } else {
    const hook = await client.setWebhook(webhookUrl(deps.publicUrl, channel.id), webhookKey);
    if (!hook.ok) {
      await updateChannel(deps.db, channel.id, { status: "error", providerState: state.value, lastError: describeFailure(hook, "webhook"), checkedAt: now });
    } else {
      await updateChannel(deps.db, channel.id, {
        status: state.value === "open" ? "connected" : "pending",
        providerState: state.value,
        lastError: state.value === "open" ? null : NOT_OPEN_MESSAGE,
        checkedAt: now,
      });
    }
  }
  return withTenant(deps.db, userId, (tx) => getWhatsAppChannelView(tx, data.storeId));
}

/** Consulta o estado da instância no provedor. Não envia mensagem a ninguém. */
export async function testWhatsApp(deps: ConnectionDeps, userId: string, storeId: string): Promise<WhatsAppChannelView> {
  const now = deps.now?.() ?? new Date();
  const { channel, orgId } = await withTenant(deps.db, userId, async (tx) => {
    const store = await requireStore(tx, storeId);
    return { channel: await loadChannelForStore(tx, storeId), orgId: store.orgId };
  });
  const setup = await withSystem(deps.db, async (tx) => {
    const { rows } = await tx.query<{ status: string; config: { baseUrl?: string; instance?: string } }>("SELECT status, config FROM channels WHERE id = $1", [
      channel.id,
    ]);
    const apiKey = await readSecretForServerUse(tx, deps.keyring, { orgId, storeId, kind: "evolution_api_key" });
    const hasWebhookKey = Boolean(await readSecretForServerUse(tx, deps.keyring, { orgId, storeId, kind: "evolution_webhook_key" }));
    return { ...rows[0], apiKey, hasWebhookKey };
  });
  if (setup.status === "disconnected" || !setup.apiKey || !setup.config.baseUrl || !setup.config.instance) {
    throw new AppError("not_configured", "Conecte uma instância antes de testar.");
  }
  const client = createEvolutionClient({ baseUrl: setup.config.baseUrl, instance: setup.config.instance, apiKey: setup.apiKey }, deps.request);
  const state = await client.connectionState();
  if (!state.ok) {
    await updateChannel(deps.db, channel.id, { status: "error", lastError: describeFailure(state, "state"), checkedAt: now });
  } else if (!setup.hasWebhookKey) {
    await updateChannel(deps.db, channel.id, { status: "error", providerState: state.value, lastError: "Webhook não registrado. Conecte de novo.", checkedAt: now });
  } else {
    await updateChannel(deps.db, channel.id, {
      status: state.value === "open" ? "connected" : "pending",
      providerState: state.value,
      lastError: state.value === "open" ? null : NOT_OPEN_MESSAGE,
      checkedAt: now,
    });
  }
  return withTenant(deps.db, userId, (tx) => getWhatsAppChannelView(tx, storeId));
}

/**
 * Desconecta o canal no Suportfy: desliga o webhook no provedor (melhor
 * esforço), apaga as chaves e marca como desconectado. Não faz logout da
 * instância no WhatsApp.
 */
export async function disconnectWhatsApp(deps: ConnectionDeps, userId: string, storeId: string): Promise<WhatsAppChannelView> {
  const { channel, orgId } = await withTenant(deps.db, userId, async (tx) => {
    const store = await requireStore(tx, storeId);
    await requireRole(tx, store.orgId, "admin");
    return { channel: await loadChannelForStore(tx, storeId), orgId: store.orgId };
  });
  const setup = await withSystem(deps.db, async (tx) => {
    const { rows } = await tx.query<{ config: { baseUrl?: string; instance?: string } }>("SELECT config FROM channels WHERE id = $1", [channel.id]);
    const apiKey = await readSecretForServerUse(tx, deps.keyring, { orgId, storeId, kind: "evolution_api_key" });
    return { config: rows[0].config, apiKey };
  });
  if (setup.apiKey && setup.config.baseUrl && setup.config.instance && deps.publicUrl) {
    await createEvolutionClient({ baseUrl: setup.config.baseUrl, instance: setup.config.instance, apiKey: setup.apiKey }, deps.request)
      .disableWebhook(webhookUrl(deps.publicUrl, channel.id))
      .catch(() => null);
  }
  await deleteSecret(deps.db, userId, { orgId, storeId, kind: "evolution_api_key" });
  await deleteSecret(deps.db, userId, { orgId, storeId, kind: "evolution_webhook_key" });
  await withSystem(deps.db, (tx) =>
    tx.query(
      `UPDATE channels SET status = 'disconnected', config = '{}'::jsonb, provider_state = NULL, last_error = NULL,
         last_checked_at = NULL, updated_at = now() WHERE id = $1`,
      [channel.id],
    ),
  );
  return withTenant(deps.db, userId, (tx) => getWhatsAppChannelView(tx, storeId));
}

/** Estado do canal para a interface (contexto do usuário; sem segredos). */
export async function getWhatsAppChannelView(tx: Tx, storeId: string): Promise<WhatsAppChannelView> {
  const { rows } = await tx.query<{
    id: string;
    org_id: string;
    status: WhatsAppChannelView["status"];
    provider_state: EvolutionState | null;
    config: { baseUrl?: string; instance?: string };
    address: string | null;
    last_error: string | null;
    last_checked_at: Date | null;
  }>(
    "SELECT id, org_id, status, provider_state, config, address, last_error, last_checked_at FROM channels WHERE store_id = $1 AND kind = 'whatsapp'",
    [storeId],
  );
  const ch = rows[0];
  if (!ch) throw new AppError("not_found", "Canal de WhatsApp não encontrado.");
  const secret = await tx.query<{ last4: string }>("SELECT last4 FROM secrets WHERE org_id = $1 AND store_id = $2 AND kind = 'evolution_api_key'", [
    ch.org_id,
    storeId,
  ]);
  let host: string | null = null;
  try {
    host = ch.config.baseUrl ? new URL(ch.config.baseUrl).host : null;
  } catch {
    host = null;
  }
  return {
    channelId: ch.id,
    status: ch.status,
    providerState: ch.provider_state,
    instance: ch.config.instance ?? null,
    host,
    address: ch.address,
    lastError: ch.last_error,
    lastCheckedAt: ch.last_checked_at?.toISOString() ?? null,
    apiKeyLast4: secret.rows[0]?.last4 ?? null,
  };
}

export interface ChannelActivity {
  received: number;
  sent: number;
  queued: number;
  failed: number;
  blocked: number;
  lastFailure: { at: string; reason: string } | null;
  /** Último motivo pelo qual o agente não respondeu (sem fila humana: fica visível aqui). */
  lastAgentIssue: { at: string; reason: string } | null;
}

const agentIssueLabels: Record<string, string> = {
  ai_provider_error: "A OpenAI não respondeu; a mensagem ficou sem resposta.",
  ai_reply_blocked: "A resposta da IA foi bloqueada pela validação (citava dados que a loja não tem).",
  missing_api_key: "Falta a chave da OpenAI; a mensagem ficou sem resposta.",
  ai_disabled: "O atendimento automático está desligado; a mensagem ficou sem resposta.",
  daily_budget_exceeded: "O teto diário de gasto com IA foi atingido.",
  reply_limit_reached: "Limite de respostas por hora atingido nesta conversa (proteção contra loop).",
};

/** Números das últimas 24 h do canal (contexto do usuário). */
export async function getChannelActivity(tx: Tx, channelId: string, now: Date = new Date()): Promise<ChannelActivity> {
  const { rows } = await tx.query<{ status: string; n: number }>(
    `SELECT m.status, count(*)::int AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.channel_id = $1 AND m.created_at > $2::timestamptz - interval '24 hours' GROUP BY m.status`,
    [channelId, now],
  );
  const count = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  const last = await tx.query<{ created_at: Date; last_error: string | null; status: string }>(
    `SELECT m.created_at, m.last_error, m.status FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE c.channel_id = $1 AND m.status IN ('failed', 'blocked') ORDER BY m.created_at DESC LIMIT 1`,
    [channelId],
  );
  const f = last.rows[0];
  const issue = await tx.query<{ created_at: Date; kind: string; reason: string | null; message: string | null }>(
    `SELECT e.created_at, e.kind, e.data->>'reason' AS reason, e.data->>'message' AS message FROM conversation_events e
     JOIN conversations c ON c.id = e.conversation_id
     WHERE c.channel_id = $1 AND e.created_at > $2::timestamptz - interval '24 hours'
       AND (e.kind IN ('ai_provider_error', 'ai_reply_blocked')
            OR (e.kind = 'ai_skipped' AND e.data->>'reason' IN ('missing_api_key', 'ai_disabled', 'daily_budget_exceeded', 'reply_limit_reached')))
     ORDER BY e.created_at DESC LIMIT 1`,
    [channelId, now],
  );
  const i = issue.rows[0];
  const lastAgentIssue = i
    ? {
        at: i.created_at.toISOString(),
        reason: `${agentIssueLabels[i.kind === "ai_skipped" ? (i.reason ?? "") : i.kind] ?? "O agente não respondeu."}${i.kind === "ai_provider_error" && i.message ? ` (${i.message})` : ""}`,
      }
    : null;
  return {
    received: count("received"),
    sent: count("sent"),
    queued: count("queued") + count("sending"),
    failed: count("failed"),
    blocked: count("blocked"),
    lastFailure: f ? { at: f.created_at.toISOString(), reason: failureLabel(f.status, f.last_error) } : null,
    lastAgentIssue,
  };
}

function failureLabel(status: string, error: string | null): string {
  if (status === "blocked") {
    if (error === "channel_not_connected") return "Canal desconectado: a resposta não foi enviada.";
    if (error === "missing_credentials" || error === "incomplete_config") return "Configuração do canal incompleta: a resposta não foi enviada.";
    return "Envio bloqueado.";
  }
  return error ?? "Falha no envio.";
}
