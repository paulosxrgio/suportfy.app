import { describe, expect, it } from "vitest";
import type { AgentContext } from "./context";
import { extractOrderRefs } from "./context";
import { evaluateGuards, isAutomatedMessage, type GuardInput } from "./guards";
import { estimateCostUsdMicros } from "./pricing";
import { validateAgentReply } from "./validate";

const ctx: AgentContext = {
  conversationId: "c",
  orgId: "o",
  storeId: "s",
  storeName: "Aurora",
  channel: "whatsapp",
  channelId: "ch",
  customer: { id: "cu", name: "Bruno", email: null, phone: "5511999990000" },
  orders: [
    {
      id: "o1",
      storeId: "s",
      customerId: "cu",
      number: "#AU1019",
      financialStatus: "paid",
      fulfillmentStatus: "in_transit",
      totalCents: 28990,
      currency: "BRL",
      items: [{ title: "Kit", quantity: 1 }],
      tracking: { carrier: "Correios", code: "AB123456789BR", url: "https://rastreio.example/AB123456789BR" },
      placedAt: new Date(),
      source: "demo",
    },
  ],
  history: [],
  subject: null,
};

const reply = (r: object) => JSON.stringify({ reply: "Olá!", referenced_orders: [], needs_customer_info: false, ...r });
const opts = { maxChars: 600, lastAiReply: null };

describe("validação da resposta da IA", () => {
  it("aceita resposta que só usa dados do contexto", () => {
    const r = validateAgentReply(
      reply({ reply: "Seu pedido #AU1019 está em trânsito, código AB123456789BR: https://rastreio.example/AB123456789BR", referenced_orders: ["#AU1019"] }),
      ctx,
      opts,
    );
    expect(r.ok).toBe(true);
  });

  it("recusa pedido, rastreio ou link inventados", () => {
    expect(validateAgentReply(reply({ reply: "Seu pedido #AU9999 foi entregue." }), ctx, opts)).toMatchObject({ ok: false, issue: "unknown_order" });
    expect(validateAgentReply(reply({ referenced_orders: ["AU2000"] }), ctx, opts)).toMatchObject({ ok: false, issue: "unknown_order" });
    expect(validateAgentReply(reply({ reply: "Código XY987654321BR." }), ctx, opts)).toMatchObject({ ok: false, issue: "unknown_tracking_code" });
    expect(validateAgentReply(reply({ reply: "Veja em https://golpe.example" }), ctx, opts)).toMatchObject({ ok: false, issue: "unexpected_link" });
  });

  it("recusa JSON inválido, formato errado, vazio, longo demais e repetição", () => {
    expect(validateAgentReply("não é json", ctx, opts)).toMatchObject({ ok: false, issue: "invalid_json" });
    expect(validateAgentReply(JSON.stringify({ reply: "x" }), ctx, opts)).toMatchObject({ ok: false, issue: "invalid_shape" });
    expect(validateAgentReply(reply({ reply: "   " }), ctx, opts)).toMatchObject({ ok: false, issue: "empty_reply" });
    expect(validateAgentReply(reply({ reply: "a".repeat(601) }), ctx, opts)).toMatchObject({ ok: false, issue: "too_long" });
    expect(validateAgentReply(reply({ reply: "Olá!" }), ctx, { ...opts, lastAiReply: "olá!" })).toMatchObject({ ok: false, issue: "repeated_reply" });
  });

  it("não confunde cupons ou códigos sem # com pedidos na resposta", () => {
    expect(validateAgentReply(reply({ reply: "Use o cupom BEMVINDO10 ou VIP2024." }), ctx, opts).ok).toBe(true);
    expect(extractOrderRefs("meu pedido é au1019")).toEqual(["#AU1019"]);
  });
});

describe("travas antes de chamar o modelo", () => {
  const base: GuardInput = {
    aiEnabled: true,
    conversationAiStatus: "active",
    latestInbound: { id: "m1", body: "Onde está meu pedido?", sender: "5511999990000" },
    latestInboundAnswered: false,
    lastAiReply: null,
    aiRepliesLastHour: 0,
    maxAiRepliesPerHour: 6,
    spentTodayUsdMicros: 0,
    dailyBudgetUsdCents: 500,
  };

  it("libera o caso normal", () => expect(evaluateGuards(base)).toBeNull());
  it("respeita IA desligada e conversa pausada", () => {
    expect(evaluateGuards({ ...base, aiEnabled: false })).toBe("ai_disabled");
    expect(evaluateGuards({ ...base, conversationAiStatus: "paused" })).toBe("conversation_paused");
  });
  it("não responde duas vezes à mesma mensagem", () => expect(evaluateGuards({ ...base, latestInboundAnswered: true })).toBe("already_answered"));
  it("ignora respostas automáticas e eco da própria resposta", () => {
    expect(evaluateGuards({ ...base, latestInbound: { id: "m", body: "Resposta automática: estou fora." } })).toBe("automated_message");
    expect(isAutomatedMessage("Olá", "no-reply@loja.example")).toBe(true);
    expect(evaluateGuards({ ...base, lastAiReply: "Onde está  meu pedido?" })).toBe("echo_of_ai_reply");
  });
  it("para em loop e quando o orçamento acaba", () => {
    expect(evaluateGuards({ ...base, aiRepliesLastHour: 6 })).toBe("reply_limit_reached");
    expect(evaluateGuards({ ...base, spentTodayUsdMicros: 5_000_000 })).toBe("daily_budget_exceeded");
  });
  it("estima custo de modelo desconhecido pelo preço mais alto", () => {
    expect(estimateCostUsdMicros("modelo-novo", 1000, 1000)).toBeGreaterThan(estimateCostUsdMicros("gpt-5-mini", 1000, 1000));
  });
});
