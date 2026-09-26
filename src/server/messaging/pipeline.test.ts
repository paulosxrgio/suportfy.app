import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LlmError, type LlmClient, type LlmRequest } from "../ai/llm";
import type { ChannelAdapter, OutboundMessage, SendResult } from "../channels/types";
import { withSystem } from "../db/tx";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";
import { createTenant, type TenantFixture } from "../testing/fixtures";
import { dispatchOutbox, ingestInbound, runAgent } from "./pipeline";

const NOW = new Date("2026-09-26T15:00:00Z");

function fakeLlm(respond: (req: LlmRequest, call: number) => string | Error): LlmClient & { requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  return {
    requests,
    async complete(req) {
      requests.push(req);
      const out = respond(req, requests.length);
      if (out instanceof Error) throw out;
      return { content: out, usage: { inputTokens: 1000, outputTokens: 200 } };
    },
  };
}

function fakeAdapter(results: SendResult[]): ChannelAdapter & { sent: OutboundMessage[] } {
  const sent: OutboundMessage[] = [];
  return {
    kind: "whatsapp",
    sent,
    async send(message) {
      sent.push(message);
      return results[Math.min(sent.length - 1, results.length - 1)];
    },
  };
}

describe.skipIf(!hasTestDatabase)("pipeline do agente (banco real)", () => {
  let db: TestDatabase;
  let a: TenantFixture;
  let b: TenantFixture;
  let phoneSeq = 0;
  const nextPhone = () => `5511988${String(100000 + ++phoneSeq)}`;

  beforeAll(async () => {
    db = await createTestDatabase();
    a = await createTenant(db.pool, "alfa");
    b = await createTenant(db.pool, "beta");
    await withSystem(db.pool, (tx) => tx.query("UPDATE ai_settings SET enabled = true WHERE store_id = ANY($1)", [[a.storeId, b.storeId]]));
  });
  afterAll(async () => db?.drop());
  beforeEach(async () => {
    await withSystem(db.pool, (tx) => tx.query("DELETE FROM ai_usage"));
  });

  const valid = (text = "Seu pedido está a caminho.") => JSON.stringify({ reply: text, referenced_orders: [], needs_customer_info: false });

  async function inbound(body: string, opts: { phone?: string; id?: string; channelId?: string } = {}) {
    return ingestInbound(db.pool, {
      channelId: opts.channelId ?? a.whatsappChannelId,
      providerMessageId: opts.id ?? `wamid-${Math.random()}`,
      from: opts.phone ?? nextPhone(),
      senderName: "Cliente Teste",
      body,
    });
  }

  it("grava a mensagem recebida uma única vez, mesmo com webhook repetido", async () => {
    const phone = nextPhone();
    const first = await inbound("Olá, quero saber do meu pedido", { phone, id: "wamid-dup" });
    const second = await inbound("Olá, quero saber do meu pedido", { phone, id: "wamid-dup" });
    expect(first.status).toBe("stored");
    expect(second).toMatchObject({ status: "duplicate" });
    const count = await withSystem(db.pool, (tx) => tx.query("SELECT count(*)::int AS n FROM messages WHERE idempotency_key = $1", [`in:${a.whatsappChannelId}:wamid-dup`]));
    expect(count.rows[0].n).toBe(1);
  });

  it("ignora mensagens do próprio número da loja", async () => {
    await withSystem(db.pool, (tx) => tx.query("UPDATE channels SET address = '5511900000000' WHERE id = $1", [a.whatsappChannelId]));
    expect(await inbound("eco", { phone: "5511900000000" })).toEqual({ status: "ignored", reason: "own_address" });
  });

  it("responde com o contexto da própria loja, incluindo pedidos, e persiste antes de enviar", async () => {
    // O cliente cita o pedido de outra organização: ele não pode entrar no contexto.
    const r = await inbound(`Oi! Meu pedido é ${a.orderNumber}, e também o ${b.orderNumber}`);
    if (r.status !== "stored") throw new Error("esperava stored");
    const llm = fakeLlm(() => valid(`Seu pedido ${a.orderNumber} está em trânsito.`));
    const result = await runAgent(db.pool, { getLlm: async () => llm, now: () => NOW }, r.conversationId);
    expect(result.status).toBe("queued");
    expect(llm.requests[0].system).toContain(a.orderNumber);
    expect(llm.requests[0].system).toContain("AB123456789BR");
    expect(llm.requests[0].system).not.toContain(b.orderNumber);

    const out = await withSystem(db.pool, (tx) =>
      tx.query("SELECT status, author, idempotency_key FROM messages WHERE conversation_id = $1 AND direction = 'outbound'", [r.conversationId]),
    );
    expect(out.rows).toEqual([{ status: "queued", author: "ai", idempotency_key: `reply:${r.messageId}` }]);
    const usage = await withSystem(db.pool, (tx) => tx.query("SELECT requests, cost_usd_micros FROM ai_usage WHERE store_id = $1", [a.storeId]));
    expect(usage.rows[0].requests).toBe(1);
    expect(Number(usage.rows[0].cost_usd_micros)).toBeGreaterThan(0);

    // Rodar de novo não gera segunda resposta.
    expect(await runAgent(db.pool, { getLlm: async () => llm, now: () => NOW }, r.conversationId)).toEqual({ status: "skipped", reason: "already_answered" });
    expect(llm.requests).toHaveLength(1);
  });

  it("bloqueia resposta inválida depois de uma nova tentativa, sem enfileirar nada", async () => {
    const r = await inbound("Cadê meu pedido?");
    if (r.status !== "stored") throw new Error("esperava stored");
    const llm = fakeLlm(() => valid("Seu pedido #ZZ9999 foi entregue ontem."));
    const result = await runAgent(db.pool, { getLlm: async () => llm, now: () => NOW }, r.conversationId);
    expect(result).toEqual({ status: "blocked", issue: "unknown_order" });
    expect(llm.requests).toHaveLength(2);
    expect(llm.requests[1].messages.at(-1)?.content).toMatch(/rejeitada/);
    const state = await withSystem(db.pool, async (tx) => {
      const out = await tx.query("SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND direction = 'outbound'", [r.conversationId]);
      const conv = await tx.query("SELECT ai_status FROM conversations WHERE id = $1", [r.conversationId]);
      const ev = await tx.query("SELECT kind FROM conversation_events WHERE conversation_id = $1 ORDER BY created_at", [r.conversationId]);
      return { out: out.rows[0].n, aiStatus: conv.rows[0].ai_status, events: ev.rows.map((e) => e.kind) };
    });
    expect(state).toEqual({ out: 0, aiStatus: "error", events: ["message_received", "ai_reply_rejected", "ai_reply_rejected", "ai_reply_blocked"] });
  });

  it("registra falha do provedor e sem chave não chama modelo", async () => {
    const r = await inbound("Oi");
    if (r.status !== "stored") throw new Error("esperava stored");
    const failing = fakeLlm(() => new LlmError("OpenAI respondeu HTTP 503.", true));
    expect(await runAgent(db.pool, { getLlm: async () => failing, now: () => NOW }, r.conversationId)).toEqual({ status: "provider_error", retryable: true });
    expect(await runAgent(db.pool, { getLlm: async () => null, now: () => NOW }, r.conversationId)).toEqual({ status: "skipped", reason: "missing_api_key" });
  });

  it("respeita orçamento diário, respostas automáticas e limite anti-loop", async () => {
    const llm = fakeLlm(() => valid());
    const auto = await inbound("Resposta automática: estou ausente até segunda.");
    if (auto.status !== "stored") throw new Error("esperava stored");
    expect(await runAgent(db.pool, { getLlm: async () => llm, now: () => NOW }, auto.conversationId)).toEqual({ status: "skipped", reason: "automated_message" });

    await withSystem(db.pool, (tx) =>
      tx.query("INSERT INTO ai_usage (store_id, org_id, day, cost_usd_micros) VALUES ($1, $2, '2026-09-26', 99000000)", [a.storeId, a.orgId]),
    );
    const r = await inbound("Oi de novo");
    if (r.status !== "stored") throw new Error("esperava stored");
    expect(await runAgent(db.pool, { getLlm: async () => llm, now: () => NOW }, r.conversationId)).toEqual({ status: "skipped", reason: "daily_budget_exceeded" });
    await withSystem(db.pool, (tx) => tx.query("DELETE FROM ai_usage"));

    // Robô do outro lado respondendo sem parar: após o limite por hora, a IA para.
    const phone = nextPhone();
    let conversationId = "";
    for (let i = 0; i < 7; i++) {
      const m = await inbound(`mensagem ${i}`, { phone });
      if (m.status !== "stored") throw new Error("esperava stored");
      conversationId = m.conversationId;
      const res = await runAgent(db.pool, { getLlm: async () => fakeLlm(() => valid(`resposta ${i}`)), now: () => NOW }, conversationId);
      expect(res.status, `rodada ${i}`).toBe(i < 6 ? "queued" : "skipped");
    }
  });

  it("envio: canal desconectado bloqueia; falha temporária tenta de novo com a mesma chave; sucesso marca enviada", async () => {
    await withSystem(db.pool, (tx) => tx.query("UPDATE messages SET status = 'failed', next_attempt_at = NULL WHERE status = 'queued'"));
    const r = await inbound("Quero rastrear");
    if (r.status !== "stored") throw new Error("esperava stored");
    await runAgent(db.pool, { getLlm: async () => fakeLlm(() => valid("Seu pedido está a caminho!")), now: () => NOW }, r.conversationId);

    const disconnected = await dispatchOutbox(db.pool, { resolveChannel: async () => ({ state: "disconnected", reason: "channel_not_connected" }), now: () => NOW });
    expect(disconnected).toEqual({ sent: 0, retrying: 0, failed: 0, blocked: 1 });

    await withSystem(db.pool, (tx) =>
      tx.query("UPDATE messages SET status = 'queued', next_attempt_at = $2 WHERE conversation_id = $1 AND direction = 'outbound'", [r.conversationId, NOW]),
    );
    const adapter = fakeAdapter([
      { ok: false, retryable: true, error: "HTTP 503" },
      { ok: true, providerMessageId: "prov-1" },
    ]);
    const deps = { resolveChannel: async () => ({ state: "connected" as const, adapter }) };
    expect(await dispatchOutbox(db.pool, { ...deps, now: () => NOW })).toMatchObject({ retrying: 1 });
    // Antes do backoff vencer, nada é reenviado.
    expect(await dispatchOutbox(db.pool, { ...deps, now: () => new Date(NOW.getTime() + 10_000) })).toMatchObject({ sent: 0, retrying: 0 });
    expect(await dispatchOutbox(db.pool, { ...deps, now: () => new Date(NOW.getTime() + 31_000) })).toMatchObject({ sent: 1 });
    expect(adapter.sent).toHaveLength(2);
    expect(adapter.sent[0].idempotencyKey).toBe(adapter.sent[1].idempotencyKey);
    const msg = await withSystem(db.pool, (tx) =>
      tx.query("SELECT status, attempts, provider_message_id FROM messages WHERE conversation_id = $1 AND direction = 'outbound'", [r.conversationId]),
    );
    expect(msg.rows[0]).toEqual({ status: "sent", attempts: 2, provider_message_id: "prov-1" });
  });

  it("envio: esgota as tentativas e marca como falha", async () => {
    await withSystem(db.pool, (tx) => tx.query("UPDATE messages SET status = 'failed', next_attempt_at = NULL WHERE status IN ('queued', 'sending')"));
    const r = await inbound("Mais uma dúvida");
    if (r.status !== "stored") throw new Error("esperava stored");
    await runAgent(db.pool, { getLlm: async () => fakeLlm(() => valid("Posso ajudar!")), now: () => NOW }, r.conversationId);
    const adapter = fakeAdapter([{ ok: false, retryable: true, error: "HTTP 500" }]);
    let t = NOW.getTime();
    for (let i = 0; i < 3; i++) {
      await dispatchOutbox(db.pool, { resolveChannel: async () => ({ state: "connected", adapter }), now: () => new Date(t), maxAttempts: 3 });
      t += 3_600_000;
    }
    const msg = await withSystem(db.pool, (tx) => tx.query("SELECT status, attempts FROM messages WHERE conversation_id = $1 AND direction = 'outbound'", [r.conversationId]));
    expect(msg.rows[0]).toEqual({ status: "failed", attempts: 3 });
  });
});
