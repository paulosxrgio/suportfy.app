import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LlmClient, LlmRequest } from "../ai/llm";
import { signUp } from "../auth/service";
import { withSystem, withTenant } from "../db/tx";
import { channelResolver, processConversation } from "../messaging/process";
import type { HttpRequest, HttpResponse } from "../net/safe-request";
import { setSecret, type SecretKeyring } from "../secrets/service";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";
import { createTenant, type TenantFixture } from "../testing/fixtures";
import { signHs256 } from "./webhook-jwt";
import { connectWhatsApp, disconnectWhatsApp, getChannelActivity, testWhatsApp, type ConnectionDeps } from "./whatsapp-connection";
import { handleEvolutionWebhook } from "./whatsapp-webhook";

const keyring: SecretKeyring = { current: { version: 1, key: randomBytes(32) } };
const NOW = new Date("2026-09-26T15:00:00Z");
const PUBLIC_URL = "https://app.suportfy.example";
const API_KEY = "evo-chave-de-teste-" + "x".repeat(16);

/** Evolution API falsa: responde conforme o estado configurado e registra cada chamada. */
function fakeEvolution() {
  const state = {
    connection: "open" as "open" | "connecting" | "close" | 401 | "network",
    webhookStatus: 201,
    sendResponses: [] as HttpResponse[],
    calls: [] as HttpRequest[],
  };
  const request = async (r: HttpRequest): Promise<HttpResponse> => {
    state.calls.push(r);
    if (r.url.includes("/instance/connectionState/")) {
      if (state.connection === "network") throw new Error("ECONNREFUSED");
      if (state.connection === 401) return { status: 401, body: '{"error":"Unauthorized"}' };
      return { status: 200, body: JSON.stringify({ instance: { instanceName: "loja-teste", state: state.connection } }) };
    }
    if (r.url.includes("/webhook/set/")) return { status: state.webhookStatus, body: "{}" };
    if (r.url.includes("/message/sendText/")) return state.sendResponses.shift() ?? { status: 201, body: JSON.stringify({ key: { id: `WAMID-${state.calls.length}` } }) };
    return { status: 404, body: "" };
  };
  return { state, request };
}

function fakeLlm(reply: (req: LlmRequest) => string): LlmClient & { requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  return {
    requests,
    async complete(req) {
      requests.push(req);
      return { content: reply(req), usage: { inputTokens: 800, outputTokens: 120 } };
    },
  };
}

const answer = (text: string, orders: string[] = []) => JSON.stringify({ reply: text, referenced_orders: orders, needs_customer_info: false });

describe.skipIf(!hasTestDatabase)("canal WhatsApp de ponta a ponta (banco real, provedores falsos)", () => {
  let db: TestDatabase;
  let a: TenantFixture;
  let b: TenantFixture;
  let evo: ReturnType<typeof fakeEvolution>;
  let deps: ConnectionDeps;
  let msgSeq = 0;

  const webhookKey = async (t: TenantFixture) =>
    withSystem(db.pool, async (tx) => {
      const { readSecretForServerUse } = await import("../secrets/service");
      return (await readSecretForServerUse(tx, keyring, { orgId: t.orgId, storeId: t.storeId, kind: "evolution_webhook_key" }))!;
    });
  const bearer = (key: string, at = NOW) => {
    const iat = Math.floor(at.getTime() / 1000);
    return `Bearer ${signHs256({ iat, exp: iat + 600, app: "evolution", action: "webhook" }, key)}`;
  };
  const upsert = (body: string, opts: { from?: string; id?: string; instance?: string } = {}) =>
    JSON.stringify({
      event: "messages.upsert",
      instance: opts.instance ?? "loja-teste",
      sender: "5511900000000@s.whatsapp.net",
      apikey: "campo-que-nunca-deve-ser-usado",
      data: {
        key: { id: opts.id ?? `3EB0-${++msgSeq}`, remoteJid: `${opts.from ?? "5511988887777"}@s.whatsapp.net`, fromMe: false },
        pushName: "Cliente WhatsApp",
        message: { conversation: body },
      },
    });
  const deliver = (t: TenantFixture, rawBody: string, authorization: string | null) =>
    handleEvolutionWebhook({ db: db.pool, keyring, now: () => NOW }, { channelId: t.whatsappChannelId, authorization, rawBody });
  const process = (conversationId: string, llm: LlmClient) =>
    processConversation(db.pool, { getLlm: async () => llm, resolveChannel: channelResolver(keyring, evo.request), now: () => NOW }, conversationId);

  beforeAll(async () => {
    db = await createTestDatabase();
    a = await createTenant(db.pool, "alfa");
    b = await createTenant(db.pool, "beta");
    evo = fakeEvolution();
    deps = { db: db.pool, keyring, request: evo.request, publicUrl: PUBLIC_URL, now: () => NOW };
    await withSystem(db.pool, (tx) => tx.query("UPDATE ai_settings SET enabled = true WHERE store_id = ANY($1)", [[a.storeId, b.storeId]]));
  });
  afterAll(async () => db?.drop());

  describe("conexão da instância", () => {
    const input = (t: TenantFixture, extra: object = {}) => ({ storeId: t.storeId, baseUrl: "https://evolution.example.com", instance: "loja-teste", apiKey: API_KEY, ...extra });

    it("recusa endereços internos (SSRF) sem chamar o provedor", async () => {
      evo.state.calls = [];
      for (const baseUrl of ["http://evolution.example.com", "https://127.0.0.1:8080", "https://169.254.169.254", "https://localhost"]) {
        await expect(connectWhatsApp(deps, a.userId, input(a, { baseUrl }))).rejects.toMatchObject({ code: "invalid_input" });
      }
      expect(evo.state.calls).toEqual([]);
    });

    it("sem SUPORTFY_PUBLIC_URL não conecta", async () => {
      await expect(connectWhatsApp({ ...deps, publicUrl: undefined }, a.userId, input(a))).rejects.toMatchObject({ code: "not_configured" });
    });

    it("membro sem papel de administrador e outra organização não conectam", async () => {
      await expect(connectWhatsApp(deps, b.userId, input(a))).rejects.toMatchObject({ code: "not_found" });
      const member = await signUp(db.pool, { name: "Membro", email: `membro-${randomBytes(3).toString("hex")}@example.com`, password: "senha-longa-123", organizationName: "Outra", storeName: "Outra" });
      await withSystem(db.pool, (tx) => tx.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [a.orgId, member.userId]));
      await expect(connectWhatsApp(deps, member.userId, input(a))).rejects.toMatchObject({ code: "forbidden" });
    });

    it("chave recusada deixa o canal em erro, sem expor a chave", async () => {
      evo.state.connection = 401;
      const view = await connectWhatsApp(deps, a.userId, input(a));
      expect(view).toMatchObject({ status: "error", lastError: "A Evolution API recusou a chave de acesso." });
      expect(JSON.stringify(view)).not.toContain(API_KEY);
    });

    it("instância fora do WhatsApp fica pendente; aberta fica conectada com webhook assinado registrado", async () => {
      evo.state.connection = "close";
      expect(await connectWhatsApp(deps, a.userId, input(a))).toMatchObject({ status: "pending", providerState: "close" });

      evo.state.connection = "open";
      evo.state.calls = [];
      const view = await connectWhatsApp(deps, a.userId, input(a, { address: "+55 11 90000-0000" }));
      expect(view).toMatchObject({ status: "connected", providerState: "open", instance: "loja-teste", host: "evolution.example.com", address: "5511900000000" });
      expect(view.apiKeyLast4).toBe(API_KEY.slice(-4));
      const hook = evo.state.calls.find((c) => c.url.includes("/webhook/set/"))!;
      const body = JSON.parse(hook.body!);
      expect(body.webhook.url).toBe(`${PUBLIC_URL}/api/webhooks/whatsapp/${a.whatsappChannelId}`);
      expect(body.webhook.headers.jwt_key).toBe(await webhookKey(a));
      expect(hook.headers?.apikey).toBe(API_KEY);
    });

    it("testar conexão só consulta o estado (nenhum envio)", async () => {
      evo.state.calls = [];
      evo.state.connection = "connecting";
      expect(await testWhatsApp(deps, a.userId, a.storeId)).toMatchObject({ status: "pending", providerState: "connecting" });
      evo.state.connection = "open";
      expect(await testWhatsApp(deps, a.userId, a.storeId)).toMatchObject({ status: "connected" });
      expect(evo.state.calls.every((c) => c.url.includes("/instance/connectionState/"))).toBe(true);
    });
  });

  describe("webhook de entrada", () => {
    it("recusa token ausente, inválido, de outro canal ou expirado", async () => {
      const body = upsert("Oi");
      expect((await deliver(a, body, null)).status).toBe(401);
      expect((await deliver(a, body, bearer("chave-errada".padEnd(43, "x")))).status).toBe(401);
      expect((await deliver(a, body, bearer(await webhookKey(a), new Date(NOW.getTime() - 20 * 60_000)))).status).toBe(401);
      const count = await withSystem(db.pool, (tx) => tx.query("SELECT count(*)::int AS n FROM messages WHERE body = 'Oi'"));
      expect(count.rows[0].n).toBe(0);
    });

    it("recusa payload inválido, instância diferente, corpo grande e canal desconhecido", async () => {
      const auth = bearer(await webhookKey(a));
      expect(await deliver(a, "{não é json", auth)).toMatchObject({ status: 400, result: "invalid_json" });
      expect(await deliver(a, JSON.stringify({ event: "messages.upsert" }), auth)).toMatchObject({ status: 400, result: "invalid_payload" });
      expect(await deliver(a, upsert("Oi", { instance: "outra-instancia" }), auth)).toMatchObject({ status: 401 });
      expect(await deliver(a, "x".repeat(300 * 1024), auth)).toMatchObject({ status: 413 });
      expect((await handleEvolutionWebhook({ db: db.pool, keyring }, { channelId: "nao-e-uuid", authorization: auth, rawBody: "{}" })).status).toBe(404);
      // Canal de B nunca foi conectado: nem chega a checar o token.
      expect((await deliver(b, upsert("Oi"), auth)).status).toBe(404);
    });

    it("fluxo completo: entrada → persistência → contexto da loja com pedidos → IA → outbox → envio", async () => {
      const auth = bearer(await webhookKey(a));
      // O cliente cita o pedido da própria loja e o de outra organização.
      const inbound = await deliver(a, upsert(`Olá! Meu pedido é ${a.orderNumber}. E o ${b.orderNumber}?`, { from: "5511977771111" }), auth);
      expect(inbound).toMatchObject({ status: 200, result: "stored" });
      const llm = fakeLlm(() => answer(`Seu pedido ${a.orderNumber} está em trânsito com os Correios, código AB123456789BR.`, [a.orderNumber]));
      evo.state.calls = [];
      const result = await process(inbound.conversationId!, llm);
      expect(result).toMatchObject({ status: "done", agent: { status: "queued" }, dispatch: { sent: 1 } });

      expect(llm.requests[0].system).toContain(a.orderNumber);
      expect(llm.requests[0].system).not.toContain(b.orderNumber);
      const send = evo.state.calls.find((c) => c.url.includes("/message/sendText/"))!;
      expect(JSON.parse(send.body!)).toEqual({ number: "5511977771111", text: expect.stringContaining(a.orderNumber) });

      const rows = await withSystem(db.pool, (tx) =>
        tx.query("SELECT direction, status, provider_message_id FROM messages WHERE conversation_id = $1 ORDER BY created_at, direction", [inbound.conversationId]),
      );
      expect(rows.rows).toEqual([
        { direction: "inbound", status: "received", provider_message_id: expect.stringMatching(/^3EB0-/) },
        { direction: "outbound", status: "sent", provider_message_id: expect.stringMatching(/^WAMID-/) },
      ]);
    });

    it("reentrega do mesmo evento não duplica mensagem nem resposta", async () => {
      const auth = bearer(await webhookKey(a));
      const body = upsert("Quero trocar o tamanho", { id: "3EB0-DUP", from: "5511966662222" });
      const first = await deliver(a, body, auth);
      const llm = fakeLlm(() => answer("Consigo ajudar com a troca."));
      await process(first.conversationId!, llm);
      const again = await deliver(a, body, auth);
      expect(again).toMatchObject({ status: 200, result: "duplicate", conversationId: first.conversationId });
      expect(await process(again.conversationId!, llm)).toMatchObject({ agent: { status: "skipped", reason: "already_answered" }, dispatch: { sent: 0 } });
      expect(llm.requests).toHaveLength(1);
      const out = await withSystem(db.pool, (tx) =>
        tx.query("SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND direction = 'outbound'", [first.conversationId]),
      );
      expect(out.rows[0].n).toBe(1);
    });

    it("dois processamentos simultâneos da mesma conversa chamam o modelo uma vez", async () => {
      const inbound = await deliver(a, upsert("Oi, tudo bem?", { from: "5511955553333" }), bearer(await webhookKey(a)));
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const slow: LlmClient & { calls: number } = {
        calls: 0,
        async complete() {
          this.calls++;
          await gate;
          return { content: answer("Tudo ótimo, como posso ajudar?"), usage: { inputTokens: 1, outputTokens: 1 } };
        },
      };
      const first = process(inbound.conversationId!, slow);
      await new Promise((r) => setTimeout(r, 50));
      expect(await process(inbound.conversationId!, slow)).toEqual({ status: "busy" });
      release();
      expect(await first).toMatchObject({ status: "done", dispatch: { sent: 1 } });
      expect(slow.calls).toBe(1);
    });

    it("mensagens da própria loja e eventos de conexão", async () => {
      const auth = bearer(await webhookKey(a));
      expect(await deliver(a, upsert("eco", { from: "5511900000000" }), auth)).toMatchObject({ status: 200, result: "ignored:own_address" });
      const close = JSON.stringify({ event: "connection.update", instance: "loja-teste", data: { state: "close" } });
      expect(await deliver(a, close, auth)).toMatchObject({ status: 200, result: "connection:close" });
      const view = await withSystem(db.pool, (tx) => tx.query("SELECT status, provider_state FROM channels WHERE id = $1", [a.whatsappChannelId]));
      expect(view.rows[0]).toEqual({ status: "pending", provider_state: "close" });
      const open = JSON.stringify({ event: "connection.update", instance: "loja-teste", data: { state: "open" } });
      await deliver(a, open, auth);
    });

    it("falha do provedor: tenta de novo com backoff e a mesma chave; depois envia uma vez só", async () => {
      const inbound = await deliver(a, upsert("Qual o prazo de entrega?", { from: "5511944444444" }), bearer(await webhookKey(a)));
      evo.state.sendResponses = [{ status: 503, body: "" }];
      evo.state.calls = [];
      const r1 = await process(inbound.conversationId!, fakeLlm(() => answer("O prazo depende do CEP; pode me informar?")));
      expect(r1).toMatchObject({ status: "done", dispatch: { retrying: 1, sent: 0 } });
      const later = new Date(NOW.getTime() + 31_000);
      const r2 = await processConversation(
        db.pool,
        { getLlm: async () => fakeLlm(() => answer("não deveria chamar")), resolveChannel: channelResolver(keyring, evo.request), now: () => later },
        inbound.conversationId!,
      );
      expect(r2).toMatchObject({ agent: { status: "skipped", reason: "already_answered" }, dispatch: { sent: 1 } });
      expect(evo.state.calls.filter((c) => c.url.includes("/message/sendText/"))).toHaveLength(2);
      const msg = await withSystem(db.pool, (tx) =>
        tx.query("SELECT status, attempts FROM messages WHERE conversation_id = $1 AND direction = 'outbound'", [inbound.conversationId]),
      );
      expect(msg.rows[0]).toEqual({ status: "sent", attempts: 2 });
    });

    it("isolamento: cliente com o mesmo telefone em outra loja não mistura conversas nem pedidos", async () => {
      // B tem um cliente com este telefone; a mensagem chega pelo canal de A.
      const phone = "5511933330000";
      await withSystem(db.pool, (tx) => tx.query("UPDATE customers SET phone = $2 WHERE id = $1", [b.customerId, phone]));
      const inbound = await deliver(a, upsert("Oi, sou eu", { from: phone }), bearer(await webhookKey(a)));
      const conv = await withSystem(db.pool, (tx) =>
        tx.query("SELECT c.store_id, cu.id AS customer_id FROM conversations c JOIN customers cu ON cu.id = c.customer_id WHERE c.id = $1", [inbound.conversationId]),
      );
      expect(conv.rows[0].store_id).toBe(a.storeId);
      expect(conv.rows[0].customer_id).not.toBe(b.customerId);
      const llm = fakeLlm(() => answer("Olá! Como posso ajudar?"));
      await process(inbound.conversationId!, llm);
      expect(llm.requests[0].system).not.toContain(b.orderNumber);
      expect(llm.requests[0].system).toContain("Nenhum pedido encontrado");
      // Usuário de B não enxerga a conversa criada em A.
      const seen = await withTenant(db.pool, b.userId, (tx) => tx.query("SELECT count(*)::int AS n FROM conversations WHERE id = $1", [inbound.conversationId]));
      expect(seen.rows[0].n).toBe(0);
    });
  });

  describe("canal desconectado", () => {
    it("desconectar apaga as chaves, bloqueia envios pendentes e recusa novos webhooks", async () => {
      const key = await webhookKey(a);
      const inbound = await deliver(a, upsert("Mensagem antes de desconectar", { from: "5511922221111" }), bearer(key));
      evo.state.calls = [];
      const view = await disconnectWhatsApp(deps, a.userId, a.storeId);
      expect(view).toMatchObject({ status: "disconnected", instance: null, apiKeyLast4: null });
      expect(evo.state.calls.some((c) => c.url.includes("/webhook/set/") && JSON.parse(c.body!).webhook.enabled === false)).toBe(true);
      const secrets = await withSystem(db.pool, (tx) => tx.query("SELECT kind FROM secrets WHERE store_id = $1", [a.storeId]));
      expect(secrets.rows).toEqual([]);

      const result = await process(inbound.conversationId!, fakeLlm(() => answer("Resposta que não pode sair.")));
      expect(result).toMatchObject({ agent: { status: "queued" }, dispatch: { blocked: 1, sent: 0 } });
      expect(await deliver(a, upsert("depois"), bearer(key))).toMatchObject({ status: 404 });

      const activity = await withTenant(db.pool, a.userId, (tx) => getChannelActivity(tx, a.whatsappChannelId, NOW));
      expect(activity.blocked).toBe(1);
      expect(activity.lastFailure?.reason).toMatch(/Canal desconectado/);
      // Outra organização não vê a atividade do canal de A.
      const other = await withTenant(db.pool, b.userId, (tx) => getChannelActivity(tx, a.whatsappChannelId, NOW));
      expect(other).toMatchObject({ received: 0, sent: 0, blocked: 0, lastFailure: null, lastAgentIssue: null });
    });
  });

  it("a chave da Evolution API nunca aparece nos dados lidos pela interface", async () => {
    await setSecret(db.pool, keyring, b.userId, { orgId: b.orgId, storeId: b.storeId, kind: "evolution_api_key", value: API_KEY });
    const rows = await withTenant(db.pool, b.userId, async (tx) => {
      const channels = await tx.query("SELECT * FROM channels");
      const secrets = await tx.query("SELECT id, kind, last4 FROM secrets");
      return JSON.stringify([channels.rows, secrets.rows]);
    });
    expect(rows).not.toContain(API_KEY);
  });
});
