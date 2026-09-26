import "server-only";
import { z } from "zod";
import type { HttpRequester } from "../net/safe-request";
import type { ChannelAdapter, SendResult } from "./types";

/*
 * WhatsApp via Evolution API v2. Endpoints e formatos conferidos no código-fonte
 * oficial (github.com/EvolutionAPI/evolution-api):
 *
 * - autenticação: cabeçalho `apikey` (chave global ou token da instância);
 * - GET  /instance/connectionState/{instance} → { instance: { instanceName, state } },
 *   com state "open" | "connecting" | "close";
 * - POST /webhook/set/{instance} com { webhook: { enabled, url, headers, byEvents, base64, events } };
 *   se `headers.jwt_key` existir, cada entrega vem com `Authorization: Bearer <JWT HS256>`
 *   assinado com essa chave (exp de 600 s, payload { app: "evolution", action: "webhook" });
 * - POST /message/sendText/{instance} com { number, text } → 201 com { key: { id } }.
 *
 * Não foi possível testar contra uma instância real neste ambiente.
 */

export interface EvolutionConfig {
  baseUrl: string;
  instance: string;
  apiKey: string;
}

export type EvolutionState = "open" | "connecting" | "close";

export type EvolutionCallResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: "unauthorized" | "not_found" | "provider_error" | "network" | "unsafe_url"; status?: number };

export const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] as const;

export function createEvolutionClient(config: EvolutionConfig, request: HttpRequester) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const instance = encodeURIComponent(config.instance);
  const headers = { apikey: config.apiKey };

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<EvolutionCallResult<string>> {
    try {
      const res = await request({ url: `${base}${path}`, method, headers, body: body === undefined ? undefined : JSON.stringify(body), timeoutMs: 15_000 });
      if (res.status >= 200 && res.status < 300) return { ok: true, value: res.body };
      if (res.status === 401 || res.status === 403) return { ok: false, kind: "unauthorized", status: res.status };
      if (res.status === 404) return { ok: false, kind: "not_found", status: res.status };
      return { ok: false, kind: "provider_error", status: res.status };
    } catch (error) {
      return { ok: false, kind: error instanceof Error && error.name === "UnsafeUrlError" ? "unsafe_url" : "network" };
    }
  }

  return {
    async connectionState(): Promise<EvolutionCallResult<EvolutionState>> {
      const res = await call("GET", `/instance/connectionState/${instance}`);
      if (!res.ok) return res;
      const parsed = z
        .object({ instance: z.object({ state: z.enum(["open", "connecting", "close"]) }) })
        .safeParse(safeJson(res.value));
      return parsed.success ? { ok: true, value: parsed.data.instance.state } : { ok: false, kind: "provider_error" };
    },

    /** Registra o webhook desta instância com a chave que assina o JWT de cada entrega. */
    async setWebhook(url: string, jwtKey: string): Promise<EvolutionCallResult<true>> {
      const res = await call("POST", `/webhook/set/${instance}`, {
        webhook: { enabled: true, url, headers: { jwt_key: jwtKey }, byEvents: false, base64: false, events: [...WEBHOOK_EVENTS] },
      });
      return res.ok ? { ok: true, value: true } : res;
    },

    /** Desliga o webhook no provedor (melhor esforço ao desconectar). */
    async disableWebhook(url: string): Promise<EvolutionCallResult<true>> {
      const res = await call("POST", `/webhook/set/${instance}`, { webhook: { enabled: false, url, events: [] } });
      return res.ok ? { ok: true, value: true } : res;
    },

    async sendText(number: string, text: string): Promise<SendResult> {
      const res = await call("POST", `/message/sendText/${instance}`, { number, text });
      if (res.ok) {
        const id = (safeJson(res.value) as { key?: { id?: unknown } } | null)?.key?.id;
        return typeof id === "string" && id ? { ok: true, providerMessageId: id } : { ok: false, retryable: false, error: "Resposta sem id da mensagem." };
      }
      if (res.kind === "network") return { ok: false, retryable: true, error: "Falha de rede com a Evolution API." };
      if (res.kind === "unsafe_url") return { ok: false, retryable: false, error: "Endereço da Evolution API bloqueado." };
      const retryable = res.kind === "provider_error" && (res.status === 429 || (res.status ?? 0) >= 500);
      return { ok: false, retryable, error: `Evolution API respondeu HTTP ${res.status ?? "?"}.` };
    },
  };
}

export type EvolutionClient = ReturnType<typeof createEvolutionClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createEvolutionAdapter(client: EvolutionClient): ChannelAdapter {
  return {
    kind: "whatsapp",
    // A Evolution API não oferece chave de idempotência no envio; a proteção
    // contra duplicidade fica na outbox (uma resposta por mensagem recebida).
    send: (message) => client.sendText(message.to.replace(/\D/g, ""), message.body),
  };
}

/* --------------------------------- Webhook --------------------------------- */

const jid = z.string().min(3).max(200);

/** Envelope comum a todos os eventos (campos extras são ignorados; `apikey` nunca é lido). */
const envelopeSchema = z.object({
  event: z.string().min(1).max(60),
  instance: z.string().min(1).max(100),
  data: z.unknown(),
  sender: z.string().max(200).optional(),
});

const upsertDataSchema = z.object({
  key: z.object({
    id: z.string().min(1).max(200),
    remoteJid: jid,
    fromMe: z.boolean(),
    remoteJidAlt: jid.optional(),
    senderPn: jid.optional(),
  }),
  pushName: z.string().max(200).nullish(),
  message: z
    .object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({ text: z.string() }).partial().optional(),
    })
    .partial()
    .nullish(),
});

const connectionDataSchema = z.object({ state: z.enum(["open", "connecting", "close"]) });

/** `owner` é o número da própria instância (campo `sender` do envelope), quando informado. */
export type EvolutionWebhookEvent = { instance: string; owner: string | null } & (
  | { type: "message"; providerMessageId: string; from: string; senderName?: string; body: string }
  | { type: "ignored"; reason: "from_me" | "group" | "not_text" | "unresolvable_sender" | "other_event" }
  | { type: "connection"; state: EvolutionState }
);

/** Número de telefone de um JID de usuário ("5511...@s.whatsapp.net"), ou null. */
function phoneFromJid(value: string | undefined): string | null {
  if (!value?.endsWith("@s.whatsapp.net")) return null;
  const digits = value.split("@")[0].split(":")[0].replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

/**
 * Interpreta o corpo do webhook. Devolve null quando o formato é inválido.
 * Mensagens da própria loja (`fromMe`) e de grupos são ignoradas; endereços
 * "@lid" só são aceitos quando o provedor informa o número real.
 */
export function parseEvolutionWebhook(payload: unknown): EvolutionWebhookEvent | null {
  const envelope = envelopeSchema.safeParse(payload);
  if (!envelope.success) return null;
  const { event } = envelope.data;
  const base = { instance: envelope.data.instance, owner: phoneFromJid(envelope.data.sender) };

  if (event === "connection.update") {
    const data = connectionDataSchema.safeParse(envelope.data.data);
    return data.success ? { ...base, type: "connection", state: data.data.state } : null;
  }
  if (event !== "messages.upsert") return { ...base, type: "ignored", reason: "other_event" };

  const data = upsertDataSchema.safeParse(envelope.data.data);
  if (!data.success) return null;
  const { key, message, pushName } = data.data;
  if (key.fromMe) return { ...base, type: "ignored", reason: "from_me" };
  if (key.remoteJid.endsWith("@g.us") || key.remoteJid.endsWith("@broadcast") || key.remoteJid.endsWith("@newsletter")) {
    return { ...base, type: "ignored", reason: "group" };
  }
  const body = (message?.conversation ?? message?.extendedTextMessage?.text ?? "").trim();
  if (!body) return { ...base, type: "ignored", reason: "not_text" };
  const from = phoneFromJid(key.remoteJid) ?? phoneFromJid(key.remoteJidAlt) ?? phoneFromJid(key.senderPn);
  if (!from) return { ...base, type: "ignored", reason: "unresolvable_sender" };
  return { ...base, type: "message", providerMessageId: key.id, from, senderName: pushName ?? undefined, body };
}
