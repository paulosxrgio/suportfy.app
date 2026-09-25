import { describe, expect, it } from "vitest";
import {
  automations,
  conversations,
  customers,
  initialAgentConfig,
  knowledgeItems,
  members,
  orders,
  stores,
} from "./data";

/**
 * Garante que o conjunto demonstrativo é coerente entre si (Inbox, Tickets,
 * Clientes e Pedidos mostram os mesmos fatos) e claramente fictício.
 */
describe("integridade dos dados demonstrativos", () => {
  const storeIds = new Set(stores.map((s) => s.id));
  const customerIds = new Set(customers.map((c) => c.id));
  const orderIds = new Set(orders.map((o) => o.id));
  const knowledgeIds = new Set(knowledgeItems.map((k) => k.id));
  const memberIds = new Set(members.map((m) => m.id));

  it("usa apenas domínios reservados para exemplos", () => {
    for (const c of customers) expect(c.email, c.name).toMatch(/@example\.com$/);
    for (const m of members) expect(m.email, m.name).toMatch(/\.example$/);
    for (const s of stores) expect(s.emailAddress).toMatch(/\.example$/);
  });

  it("referências entre entidades existem", () => {
    for (const c of customers) expect(storeIds.has(c.storeId), c.id).toBe(true);
    for (const o of orders) {
      expect(customerIds.has(o.customerId), o.id).toBe(true);
      expect(storeIds.has(o.storeId), o.id).toBe(true);
      expect(o.number).toBe(`#${o.id}`);
    }
    for (const c of conversations) {
      expect(customerIds.has(c.customerId), c.id).toBe(true);
      expect(storeIds.has(c.storeId), c.id).toBe(true);
      for (const id of c.orderIds) expect(orderIds.has(id), `${c.id} → ${id}`).toBe(true);
      if (c.assigneeId) expect(memberIds.has(c.assigneeId), c.id).toBe(true);
    }
  });

  it("pedidos citados em uma conversa pertencem ao mesmo cliente e loja", () => {
    for (const c of conversations) {
      for (const id of c.orderIds) {
        const o = orders.find((x) => x.id === id)!;
        expect(o.customerId, `${c.id} → ${id}`).toBe(c.customerId);
        expect(o.storeId, `${c.id} → ${id}`).toBe(c.storeId);
      }
    }
  });

  it("fontes citadas pela IA existem e só usam conhecimento publicado", () => {
    for (const c of conversations) {
      const drafts = [c.aiDraft?.sources ?? [], ...c.timeline.map((t) => (t.type === "message" ? (t.sources ?? []) : []))].flat();
      for (const s of drafts) {
        if (s.kind === "order") expect(orderIds.has(s.refId!), `${c.id} → ${s.refId}`).toBe(true);
        if (s.kind === "knowledge") {
          expect(knowledgeIds.has(s.refId!), `${c.id} → ${s.refId}`).toBe(true);
          expect(knowledgeItems.find((k) => k.id === s.refId)!.status, `${c.id} → ${s.refId}`).toBe("publicado");
        }
      }
    }
  });

  it("linhas do tempo estão em ordem cronológica", () => {
    for (const c of conversations) {
      const times = c.timeline.map((t) => Date.parse(t.at));
      expect(times, c.id).toEqual([...times].sort((a, b) => a - b));
      expect(c.lastActivityAt, c.id).toBe(c.timeline.at(-1)!.at);
    }
  });

  it("ids e números de ticket são únicos", () => {
    const ids = conversations.map((c) => c.id);
    const tickets = conversations.map((c) => c.ticketNumber);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(tickets).size).toBe(tickets.length);
    const timelineIds = conversations.flatMap((c) => c.timeline.map((t) => t.id));
    expect(new Set(timelineIds).size).toBe(timelineIds.length);
  });

  it("conversas encaminhadas registram o motivo", () => {
    for (const c of conversations.filter((x) => x.state === "needs_review")) expect(c.handoff, c.id).toBeDefined();
    for (const c of conversations.filter((x) => x.state === "agent_error")) expect(c.error, c.id).toBeTruthy();
  });

  it("configuração do agente cobre todas as lojas e canais", () => {
    for (const s of stores) {
      expect(initialAgentConfig.channels[s.id].whatsapp).toBeDefined();
      expect(initialAgentConfig.channels[s.id].email).toBeDefined();
    }
    for (const a of automations) expect(a.storeId === "all" || storeIds.has(a.storeId), a.id).toBe(true);
  });
});
