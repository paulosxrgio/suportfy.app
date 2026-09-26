import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse } from "../net/safe-request";
import { createEvolutionClient, parseEvolutionWebhook } from "./evolution";
import { signHs256, verifyEvolutionJwt } from "./webhook-jwt";

const upsert = (data: object, extra: object = {}) => ({
  event: "messages.upsert",
  instance: "loja-teste",
  sender: "5511900000000@s.whatsapp.net",
  apikey: "nunca-usada",
  data,
  ...extra,
});
const text = (key: object, message: object = { conversation: "Oi, cadê meu pedido?" }) => ({
  key: { id: "3EB0ABC", remoteJid: "5511988887777@s.whatsapp.net", fromMe: false, ...key },
  pushName: "Bruno",
  message,
});

describe("webhook da Evolution API: formato", () => {
  it("lê mensagem de texto e o número da própria instância", () => {
    expect(parseEvolutionWebhook(upsert(text({})))).toEqual({
      type: "message",
      instance: "loja-teste",
      owner: "5511900000000",
      providerMessageId: "3EB0ABC",
      from: "5511988887777",
      senderName: "Bruno",
      body: "Oi, cadê meu pedido?",
    });
    expect(parseEvolutionWebhook(upsert(text({}, { extendedTextMessage: { text: "Com link" } })))).toMatchObject({ type: "message", body: "Com link" });
  });

  it("ignora mensagens da loja, grupos, mídia sem texto e outros eventos", () => {
    expect(parseEvolutionWebhook(upsert(text({ fromMe: true })))).toMatchObject({ type: "ignored", reason: "from_me" });
    expect(parseEvolutionWebhook(upsert(text({ remoteJid: "12036302@g.us" })))).toMatchObject({ type: "ignored", reason: "group" });
    expect(parseEvolutionWebhook(upsert(text({}, { imageMessage: {} })))).toMatchObject({ type: "ignored", reason: "not_text" });
    expect(parseEvolutionWebhook({ event: "presence.update", instance: "loja-teste", data: {} })).toMatchObject({ type: "ignored", reason: "other_event" });
  });

  it("endereço @lid só é aceito com o número real informado pelo provedor", () => {
    expect(parseEvolutionWebhook(upsert(text({ remoteJid: "12345678901234@lid" })))).toMatchObject({ type: "ignored", reason: "unresolvable_sender" });
    expect(parseEvolutionWebhook(upsert(text({ remoteJid: "12345678901234@lid", senderPn: "5511977776666@s.whatsapp.net" })))).toMatchObject({
      type: "message",
      from: "5511977776666",
    });
  });

  it("lê mudança de conexão e recusa formatos inválidos", () => {
    expect(parseEvolutionWebhook({ event: "connection.update", instance: "loja-teste", data: { state: "close" } })).toMatchObject({ type: "connection", state: "close" });
    expect(parseEvolutionWebhook({ event: "connection.update", instance: "loja-teste", data: { state: "hackeado" } })).toBeNull();
    expect(parseEvolutionWebhook({ nada: true })).toBeNull();
    expect(parseEvolutionWebhook(upsert({ key: { id: "x" } }))).toBeNull();
    expect(parseEvolutionWebhook("texto")).toBeNull();
  });
});

describe("JWT do webhook (HS256, como a Evolution API gera)", () => {
  const key = "a".repeat(43);
  const now = new Date("2026-09-26T12:00:00Z");
  const iat = Math.floor(now.getTime() / 1000);
  const valid = signHs256({ iat, exp: iat + 600, app: "evolution", action: "webhook" }, key);

  it("aceita token válido", () => expect(verifyEvolutionJwt(`Bearer ${valid}`, key, now)).toEqual({ ok: true }));
  it("recusa ausência, chave errada, expirado e alterado", () => {
    expect(verifyEvolutionJwt(null, key, now)).toMatchObject({ reason: "malformed" });
    expect(verifyEvolutionJwt(`Bearer ${valid}`, "b".repeat(43), now)).toMatchObject({ reason: "bad_signature" });
    expect(verifyEvolutionJwt(`Bearer ${valid}`, key, new Date(now.getTime() + 11 * 60_000 + 61_000))).toMatchObject({ reason: "expired" });
    const [h, , s] = valid.split(".");
    const forged = Buffer.from(JSON.stringify({ iat, exp: iat + 600, app: "evolution", action: "webhook", extra: 1 })).toString("base64url");
    expect(verifyEvolutionJwt(`Bearer ${h}.${forged}.${s}`, key, now)).toMatchObject({ reason: "bad_signature" });
  });
  it("recusa alg none e outras declarações", () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${valid.split(".")[1]}.${valid.split(".")[2]}`;
    expect(verifyEvolutionJwt(`Bearer ${none}`, key, now)).toMatchObject({ reason: "bad_algorithm" });
    expect(verifyEvolutionJwt(`Bearer ${signHs256({ iat, exp: iat + 600, app: "outro", action: "webhook" }, key)}`, key, now)).toMatchObject({ reason: "bad_claims" });
    expect(verifyEvolutionJwt(`Bearer ${signHs256({ iat, exp: iat + 86_400, app: "evolution", action: "webhook" }, key)}`, key, now)).toMatchObject({ reason: "bad_claims" });
  });
});

describe("cliente da Evolution API", () => {
  function fake(respond: (r: HttpRequest) => HttpResponse) {
    const calls: HttpRequest[] = [];
    return { calls, request: async (r: HttpRequest) => (calls.push(r), respond(r)) };
  }
  const config = { baseUrl: "https://evolution.example.com/", instance: "loja teste", apiKey: "chave-de-teste-1234567" };

  it("usa as rotas e o cabeçalho apikey da documentação", async () => {
    const f = fake((r) =>
      r.url.includes("connectionState")
        ? { status: 200, body: JSON.stringify({ instance: { instanceName: "loja teste", state: "open" } }) }
        : r.url.includes("sendText")
          ? { status: 201, body: JSON.stringify({ key: { id: "WAMID1" } }) }
          : { status: 201, body: "{}" },
    );
    const client = createEvolutionClient(config, f.request);
    expect(await client.connectionState()).toEqual({ ok: true, value: "open" });
    expect(await client.setWebhook("https://app.example.com/api/webhooks/whatsapp/x", "k".repeat(43))).toEqual({ ok: true, value: true });
    expect(await client.sendText("5511988887777", "Olá")).toEqual({ ok: true, providerMessageId: "WAMID1" });
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://evolution.example.com/instance/connectionState/loja%20teste",
      "POST https://evolution.example.com/webhook/set/loja%20teste",
      "POST https://evolution.example.com/message/sendText/loja%20teste",
    ]);
    expect(f.calls.every((c) => c.headers?.apikey === config.apiKey)).toBe(true);
    expect(JSON.parse(f.calls[1].body!)).toEqual({
      webhook: {
        enabled: true,
        url: "https://app.example.com/api/webhooks/whatsapp/x",
        headers: { jwt_key: "k".repeat(43) },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      },
    });
    expect(JSON.parse(f.calls[2].body!)).toEqual({ number: "5511988887777", text: "Olá" });
  });

  it("classifica falhas: chave recusada, erro temporário e rede", async () => {
    expect(await createEvolutionClient(config, fake(() => ({ status: 401, body: "" })).request).connectionState()).toMatchObject({ ok: false, kind: "unauthorized" });
    expect(await createEvolutionClient(config, fake(() => ({ status: 503, body: "" })).request).sendText("5511", "x")).toMatchObject({ ok: false, retryable: true });
    expect(await createEvolutionClient(config, fake(() => ({ status: 400, body: "" })).request).sendText("5511", "x")).toMatchObject({ ok: false, retryable: false });
    const network = createEvolutionClient(config, async () => {
      throw new Error("ECONNRESET");
    });
    expect(await network.sendText("5511", "x")).toMatchObject({ ok: false, retryable: true });
  });
});
