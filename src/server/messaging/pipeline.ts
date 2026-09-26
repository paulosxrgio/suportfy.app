import "server-only";
import { buildContext, renderSystemPrompt } from "../ai/context";
import { evaluateGuards, type SkipReason } from "../ai/guards";
import { LlmError, type LlmClient } from "../ai/llm";
import { estimateCostUsdMicros } from "../ai/pricing";
import { validateAgentReply, type ValidationIssue } from "../ai/validate";
import type { ChannelAvailability } from "../channels/resolve";
import { withSystem, type Db, type Tx } from "../db/tx";
import { AppError } from "../errors";

/*
 * Pipeline do atendimento automático. Três passos independentes, cada um
 * seguro para repetir:
 *
 * 1. ingestInbound: grava a mensagem recebida (deduplicada pelo id do provedor).
 * 2. runAgent: aplica as travas, monta o contexto da loja (com pedidos), chama o
 *    modelo, valida a resposta e a enfileira como mensagem "queued". Uma resposta
 *    por mensagem recebida, garantida pela chave de idempotência.
 * 3. dispatchOutbox: envia o que está na fila pelo canal, com novas tentativas e
 *    backoff. Canal desconectado bloqueia o envio em vez de fingir sucesso.
 *
 * Não existe fila de atendimento humano: quando a IA não consegue responder com
 * segurança, a mensagem não é enviada e o motivo fica registrado nos eventos.
 */

export async function recordEvent(tx: Tx, conv: { orgId: string; storeId: string; conversationId: string }, kind: string, data: object = {}) {
  await tx.query("INSERT INTO conversation_events (org_id, store_id, conversation_id, kind, data) VALUES ($1, $2, $3, $4, $5)", [
    conv.orgId,
    conv.storeId,
    conv.conversationId,
    kind,
    JSON.stringify(data),
  ]);
}

/* ------------------------------ 1. Recebimento ------------------------------ */

export interface InboundInput {
  channelId: string;
  providerMessageId: string;
  /** Telefone (WhatsApp) ou e-mail (e-mail) do remetente. */
  from: string;
  senderName?: string;
  body: string;
  subject?: string;
}

export type IngestResult =
  | { status: "stored"; conversationId: string; messageId: string }
  | { status: "duplicate"; conversationId: string; messageId: string }
  | { status: "ignored"; reason: "own_address" | "empty" };

export async function ingestInbound(db: Db, input: InboundInput): Promise<IngestResult> {
  const body = input.body.trim().slice(0, 20_000);
  if (!body) return { status: "ignored", reason: "empty" };
  const key = `in:${input.channelId}:${input.providerMessageId}`;

  return withSystem(db, async (tx) => {
    const ch = await tx.query<{ org_id: string; store_id: string; kind: "whatsapp" | "email"; address: string | null }>(
      "SELECT org_id, store_id, kind, address FROM channels WHERE id = $1",
      [input.channelId],
    );
    const channel = ch.rows[0];
    if (!channel) throw new AppError("not_found", "Canal não encontrado.");

    const existing = await tx.query<{ id: string; conversation_id: string }>("SELECT id, conversation_id FROM messages WHERE idempotency_key = $1", [key]);
    if (existing.rows[0]) return { status: "duplicate", conversationId: existing.rows[0].conversation_id, messageId: existing.rows[0].id };

    const from = channel.kind === "whatsapp" ? input.from.replace(/\D/g, "") : input.from.trim().toLowerCase();
    const own = channel.kind === "whatsapp" ? channel.address?.replace(/\D/g, "") : channel.address?.toLowerCase();
    if (own && from === own) return { status: "ignored", reason: "own_address" };
    if (channel.kind === "whatsapp" && !/^\d{8,15}$/.test(from)) throw new AppError("invalid_input", "Telefone do remetente inválido.");
    if (channel.kind === "email" && !/^[^\s@]+@[^\s@]+$/.test(from)) throw new AppError("invalid_input", "E-mail do remetente inválido.");

    const scope = [channel.org_id, channel.store_id] as const;
    const name = (input.senderName ?? "").trim().slice(0, 200);
    const customer =
      channel.kind === "whatsapp"
        ? await tx.query<{ id: string }>(
            `INSERT INTO customers (org_id, store_id, name, phone, source) VALUES ($1, $2, $3, $4, 'channel')
             ON CONFLICT (store_id, phone) WHERE phone IS NOT NULL
             DO UPDATE SET name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END
             RETURNING id`,
            [...scope, name, from],
          )
        : await tx.query<{ id: string }>(
            `INSERT INTO customers (org_id, store_id, name, email, source) VALUES ($1, $2, $3, $4, 'channel')
             ON CONFLICT (store_id, email) WHERE email IS NOT NULL
             DO UPDATE SET name = CASE WHEN customers.name = '' THEN EXCLUDED.name ELSE customers.name END
             RETURNING id`,
            [...scope, name, from],
          );
    const customerId = customer.rows[0].id;

    await tx.query(
      `INSERT INTO conversations (org_id, store_id, channel_id, customer_id, subject) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (channel_id, customer_id) WHERE status = 'open' DO NOTHING`,
      [...scope, input.channelId, customerId, input.subject?.slice(0, 200) ?? null],
    );
    const conv = await tx.query<{ id: string }>(
      "SELECT id FROM conversations WHERE channel_id = $1 AND customer_id = $2 AND status = 'open' FOR UPDATE",
      [input.channelId, customerId],
    );
    const conversationId = conv.rows[0].id;

    const msg = await tx.query<{ id: string }>(
      `INSERT INTO messages (org_id, store_id, conversation_id, direction, author, body, status, idempotency_key, provider_message_id, meta)
       VALUES ($1, $2, $3, 'inbound', 'customer', $4, 'received', $5, $6, $7)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [...scope, conversationId, body, key, input.providerMessageId, JSON.stringify({ sender: from })],
    );
    if (!msg.rows[0]) {
      const again = await tx.query<{ id: string; conversation_id: string }>("SELECT id, conversation_id FROM messages WHERE idempotency_key = $1", [key]);
      return { status: "duplicate", conversationId: again.rows[0].conversation_id, messageId: again.rows[0].id };
    }
    await tx.query("UPDATE conversations SET last_message_at = now() WHERE id = $1", [conversationId]);
    await recordEvent(tx, { orgId: channel.org_id, storeId: channel.store_id, conversationId }, "message_received", { messageId: msg.rows[0].id });
    return { status: "stored", conversationId, messageId: msg.rows[0].id };
  });
}

/* ------------------------------- 2. Agente IA ------------------------------- */

export interface AgentDeps {
  /** Cliente do modelo para a loja, ou null se não houver chave configurada. */
  getLlm: (scope: { orgId: string; storeId: string }) => Promise<LlmClient | null>;
  now?: () => Date;
}

export type AgentResult =
  | { status: "queued"; messageId: string }
  | { status: "skipped"; reason: SkipReason | "missing_api_key" }
  | { status: "blocked"; issue: ValidationIssue }
  | { status: "provider_error"; retryable: boolean };

const MAX_ATTEMPTS = 2;

interface AgentState {
  org_id: string;
  store_id: string;
  ai_status: "active" | "paused" | "error";
  enabled: boolean;
  model: string;
  daily_budget_usd_cents: number;
  max_ai_replies_per_hour: number;
  max_reply_chars: number;
  latest_inbound: { id: string; body: string; sender: string | null } | null;
  last_ai_reply: string | null;
  ai_replies_last_hour: number;
  spent_today: string | number;
}

export async function runAgent(db: Db, deps: AgentDeps, conversationId: string): Promise<AgentResult> {
  const now = deps.now?.() ?? new Date();

  const state = await withSystem(db, async (tx) => {
    const { rows } = await tx.query<AgentState>(
      `SELECT c.org_id, c.store_id, c.ai_status, s.enabled, s.model, s.daily_budget_usd_cents, s.max_ai_replies_per_hour, s.max_reply_chars,
         (SELECT row_to_json(m) FROM (SELECT id, body, meta->>'sender' AS sender FROM messages
            WHERE conversation_id = c.id AND direction = 'inbound' ORDER BY created_at DESC, id DESC LIMIT 1) m) AS latest_inbound,
         (SELECT body FROM messages WHERE conversation_id = c.id AND author = 'ai' AND status <> 'blocked'
            ORDER BY created_at DESC, id DESC LIMIT 1) AS last_ai_reply,
         (SELECT count(*)::int FROM messages WHERE conversation_id = c.id AND author = 'ai'
            AND created_at > $2::timestamptz - interval '1 hour') AS ai_replies_last_hour,
         coalesce((SELECT cost_usd_micros FROM ai_usage WHERE store_id = c.store_id
            AND day = ($2::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date), 0)::bigint AS spent_today
       FROM conversations c JOIN ai_settings s ON s.store_id = c.store_id
       WHERE c.id = $1`,
      [conversationId, now],
    );
    const r = rows[0];
    if (!r) throw new AppError("not_found", "Conversa não encontrada.");
    let answered = false;
    if (r.latest_inbound) {
      const a = await tx.query("SELECT 1 FROM messages WHERE idempotency_key = $1", [`reply:${r.latest_inbound.id}`]);
      answered = Boolean(a.rows[0]);
    }
    return { ...r, answered };
  });

  const scope = { orgId: state.org_id, storeId: state.store_id, conversationId };
  const skip = evaluateGuards({
    aiEnabled: state.enabled,
    conversationAiStatus: state.ai_status,
    latestInbound: state.latest_inbound,
    latestInboundAnswered: state.answered,
    lastAiReply: state.last_ai_reply,
    aiRepliesLastHour: state.ai_replies_last_hour,
    maxAiRepliesPerHour: state.max_ai_replies_per_hour,
    spentTodayUsdMicros: Number(state.spent_today),
    dailyBudgetUsdCents: state.daily_budget_usd_cents,
  });
  if (skip) {
    if (skip !== "already_answered") await withSystem(db, (tx) => recordEvent(tx, scope, "ai_skipped", { reason: skip }));
    return { status: "skipped", reason: skip };
  }

  const llm = await deps.getLlm(scope);
  if (!llm) {
    await withSystem(db, (tx) => recordEvent(tx, scope, "ai_skipped", { reason: "missing_api_key" }));
    return { status: "skipped", reason: "missing_api_key" };
  }

  const ctx = await withSystem(db, (tx) => buildContext(tx, conversationId));
  if (!ctx) throw new AppError("not_found", "Conversa não encontrada.");
  const inboundId = state.latest_inbound!.id;
  const messages = ctx.history
    .filter((m) => m.author !== "system")
    .map((m) => ({ role: m.author === "customer" ? ("user" as const) : ("assistant" as const), content: m.body }));

  let lastIssue: ValidationIssue = "invalid_json";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let result;
    try {
      result = await llm.complete({ model: state.model, system: renderSystemPrompt(ctx), messages });
    } catch (error) {
      const retryable = error instanceof LlmError ? error.retryable : true;
      await withSystem(db, (tx) => recordEvent(tx, scope, "ai_provider_error", { retryable, message: error instanceof LlmError ? error.message : "erro inesperado" }));
      return { status: "provider_error", retryable };
    }

    const cost = estimateCostUsdMicros(state.model, result.usage.inputTokens, result.usage.outputTokens);
    const validation = validateAgentReply(result.content, ctx, { maxChars: state.max_reply_chars, lastAiReply: state.last_ai_reply });

    const outcome = await withSystem(db, async (tx) => {
      await tx.query(
        `INSERT INTO ai_usage (store_id, org_id, day, requests, input_tokens, output_tokens, cost_usd_micros)
         VALUES ($1, $2, ($3::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date, 1, $4, $5, $6)
         ON CONFLICT (store_id, day) DO UPDATE SET requests = ai_usage.requests + 1,
           input_tokens = ai_usage.input_tokens + EXCLUDED.input_tokens,
           output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens,
           cost_usd_micros = ai_usage.cost_usd_micros + EXCLUDED.cost_usd_micros`,
        [scope.storeId, scope.orgId, now, result.usage.inputTokens, result.usage.outputTokens, cost],
      );
      if (!validation.ok) {
        await recordEvent(tx, scope, "ai_reply_rejected", { attempt, issue: validation.issue, detail: validation.detail ?? null });
        return null;
      }
      // Persistida antes de qualquer envio. A chave impede uma segunda resposta à mesma mensagem.
      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO messages (org_id, store_id, conversation_id, direction, author, body, status, idempotency_key, next_attempt_at, created_at, meta)
         VALUES ($1, $2, $3, 'outbound', 'ai', $4, 'queued', $5, $6, $6, $7)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [
          scope.orgId,
          scope.storeId,
          conversationId,
          validation.reply.reply,
          `reply:${inboundId}`,
          now,
          JSON.stringify({ model: state.model, referencedOrders: validation.reply.referenced_orders, inReplyTo: inboundId }),
        ],
      );
      if (!inserted.rows[0]) return "duplicate" as const;
      await tx.query("UPDATE conversations SET last_message_at = $2, ai_status = 'active' WHERE id = $1", [conversationId, now]);
      await recordEvent(tx, scope, "ai_replied", { messageId: inserted.rows[0].id, costUsdMicros: cost });
      return inserted.rows[0].id;
    });

    if (outcome === "duplicate") return { status: "skipped", reason: "already_answered" };
    if (outcome) return { status: "queued", messageId: outcome };
    lastIssue = validation.ok ? lastIssue : validation.issue;
    messages.push(
      { role: "assistant", content: result.content },
      { role: "user", content: `[Sistema] A resposta anterior foi rejeitada pela validação (${lastIssue}). Responda de novo seguindo as regras e usando só os dados fornecidos.` },
    );
  }

  await withSystem(db, async (tx) => {
    await tx.query("UPDATE conversations SET ai_status = 'error' WHERE id = $1", [conversationId]);
    await recordEvent(tx, scope, "ai_reply_blocked", { issue: lastIssue });
  });
  return { status: "blocked", issue: lastIssue };
}

/* --------------------------------- 3. Envio --------------------------------- */

export interface DispatchDeps {
  resolveChannel: (tx: Tx, channelId: string) => Promise<ChannelAvailability>;
  now?: () => Date;
  maxAttempts?: number;
  batchSize?: number;
  /** Limita o envio a uma conversa (usado logo após responder um webhook). */
  conversationId?: string;
}

export interface DispatchSummary {
  sent: number;
  retrying: number;
  failed: number;
  blocked: number;
}

/** Espera antes da próxima tentativa: 30 s, 1 min, 2 min… até 1 hora. */
export function backoffSeconds(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(0, attempts - 1), 3600);
}

const LEASE_SECONDS = 120;

export async function dispatchOutbox(db: Db, deps: DispatchDeps): Promise<DispatchSummary> {
  const now = deps.now?.() ?? new Date();
  const maxAttempts = deps.maxAttempts ?? 5;
  const summary: DispatchSummary = { sent: 0, retrying: 0, failed: 0, blocked: 0 };

  // Reserva mensagens vencidas. Uma mensagem "sending" cujo prazo expirou
  // (processo caiu no meio do envio) volta a ser elegível.
  const claimed = await withSystem(db, (tx) =>
    tx.query<{ id: string; org_id: string; store_id: string; conversation_id: string; body: string; idempotency_key: string; attempts: number }>(
      `UPDATE messages SET status = 'sending', attempts = attempts + 1, next_attempt_at = $1::timestamptz + make_interval(secs => $3::double precision)
       WHERE id IN (
         SELECT id FROM messages
         WHERE direction = 'outbound' AND status IN ('queued', 'sending') AND next_attempt_at <= $1
           AND ($4::uuid IS NULL OR conversation_id = $4)
         ORDER BY next_attempt_at LIMIT $2 FOR UPDATE SKIP LOCKED
       )
       RETURNING id, org_id, store_id, conversation_id, body, idempotency_key, attempts`,
      [now, deps.batchSize ?? 20, LEASE_SECONDS, deps.conversationId ?? null],
    ),
  );

  for (const m of claimed.rows) {
    const scope = { orgId: m.org_id, storeId: m.store_id, conversationId: m.conversation_id };
    const target = await withSystem(db, async (tx) => {
      const { rows } = await tx.query<{ channel_id: string; kind: string; phone: string | null; email: string | null; subject: string | null }>(
        `SELECT c.channel_id, ch.kind, cu.phone, cu.email, c.subject FROM conversations c
         JOIN channels ch ON ch.id = c.channel_id JOIN customers cu ON cu.id = c.customer_id WHERE c.id = $1`,
        [m.conversation_id],
      );
      const row = rows[0];
      return { row, availability: await deps.resolveChannel(tx, row.channel_id) };
    });

    const to = target.row.kind === "whatsapp" ? target.row.phone : target.row.email;
    if (target.availability.state !== "connected" || !to) {
      const reason = target.availability.state === "connected" ? "missing_recipient" : target.availability.reason;
      await withSystem(db, async (tx) => {
        // Não houve chamada ao provedor: a reserva não conta como tentativa.
        await tx.query("UPDATE messages SET status = 'blocked', attempts = attempts - 1, next_attempt_at = NULL, last_error = $2 WHERE id = $1", [
          m.id,
          reason,
        ]);
        await recordEvent(tx, scope, "message_blocked", { messageId: m.id, reason });
      });
      summary.blocked++;
      continue;
    }

    const result = await target.availability.adapter.send({
      to,
      body: m.body,
      subject: target.row.subject ? `Re: ${target.row.subject}` : undefined,
      idempotencyKey: m.idempotency_key,
    });

    await withSystem(db, async (tx) => {
      if (result.ok) {
        await tx.query("UPDATE messages SET status = 'sent', sent_at = $2, provider_message_id = $3, next_attempt_at = NULL, last_error = NULL WHERE id = $1", [
          m.id,
          now,
          result.providerMessageId,
        ]);
        summary.sent++;
      } else if (result.retryable && m.attempts < maxAttempts) {
        await tx.query(
          "UPDATE messages SET status = 'queued', last_error = $2, next_attempt_at = $3::timestamptz + make_interval(secs => $4::double precision) WHERE id = $1",
          [m.id, result.error, now, backoffSeconds(m.attempts)],
        );
        summary.retrying++;
      } else {
        await tx.query("UPDATE messages SET status = 'failed', last_error = $2, next_attempt_at = NULL WHERE id = $1", [m.id, result.error]);
        await recordEvent(tx, scope, "message_failed", { messageId: m.id, attempts: m.attempts, error: result.error });
        summary.failed++;
      }
    });
  }
  return summary;
}
