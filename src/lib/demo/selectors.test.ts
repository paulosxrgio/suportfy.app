import { describe, expect, it } from "vitest";
import { conversations, customers, orders } from "./data";
import {
  customerStats,
  emptyInboxFilters,
  filterConversations,
  inQueue,
  inView,
  orderTotal,
  slaInfo,
  sortConversations,
  ticketStatus,
  viewHasQueues,
} from "./selectors";

const lookup = {
  customerName: (id: string) => customers.find((c) => c.id === id)?.name ?? "",
  currentUserId: "u-marina",
};
const byId = (id: string) => conversations.find((c) => c.id === id)!;

describe("status de ticket", () => {
  it("deriva do estado da conversa", () => {
    expect(ticketStatus("needs_review")).toBe("aberto");
    expect(ticketStatus("awaiting_customer")).toBe("pendente");
    expect(ticketStatus("awaiting_order_info")).toBe("pendente");
    expect(ticketStatus("auto_resolved")).toBe("resolvido");
  });
});

describe("SLA", () => {
  it("classifica em risco, vencido, pausado e cumprido", () => {
    expect(slaInfo(byId("cv-01")).status).toBe("risco");
    expect(slaInfo(byId("cv-08")).status).toBe("vencido");
    expect(slaInfo(byId("cv-04")).status).toBe("pausado");
    expect(slaInfo(byId("cv-09")).status).toBe("cumprido");
    expect(slaInfo(byId("cv-02")).status).toBe("ok");
  });
});

describe("filas da Inbox", () => {
  it("cada conversa pertence a exatamente uma fila", () => {
    for (const c of conversations) {
      const queues = (["revisao", "ia", "equipe", "resolvidas"] as const).filter((q) => inQueue(c, q));
      expect(queues, c.id).toHaveLength(1);
    }
  });

  it("a fila de revisão reúne encaminhamentos e erros do agente", () => {
    const ids = conversations.filter((c) => inQueue(c, "revisao")).map((c) => c.id).sort();
    expect(ids).toEqual(["cv-01", "cv-02", "cv-07", "cv-08"]);
  });
});

describe("filtros e ordenação", () => {
  it("filtra por canal, loja, responsável e não lidas", () => {
    const email = filterConversations(conversations, { ...emptyInboxFilters, channels: ["email"] }, lookup);
    expect(email.every((c) => c.channel === "email")).toBe(true);

    const mine = filterConversations(conversations, { ...emptyInboxFilters, assignees: ["me"] }, lookup);
    expect(mine.map((c) => c.id)).toEqual(["cv-11"]);

    const ai = filterConversations(conversations, { ...emptyInboxFilters, assignees: ["ai"] }, lookup);
    expect(ai.every((c) => c.assigneeId === null)).toBe(true);
    expect(ai.some((c) => c.state === "needs_review")).toBe(false);

    const unread = filterConversations(conversations, { ...emptyInboxFilters, unreadOnly: true }, lookup);
    expect(unread.every((c) => c.unreadCount > 0)).toBe(true);
  });

  it("busca por cliente, pedido e ticket", () => {
    const search = (query: string) => filterConversations(conversations, { ...emptyInboxFilters, query }, lookup).map((c) => c.id);
    expect(search("juliana")).toEqual(["cv-01"]);
    expect(search("#TO5531")).toEqual(["cv-02"]);
    expect(search("4815")).toContain("cv-11");
  });

  it("respeita a fila, a menos que seja ignorada", () => {
    const filters = { ...emptyInboxFilters, queue: "resolvidas" as const };
    expect(filterConversations(conversations, filters, lookup).every((c) => inQueue(c, "resolvidas"))).toBe(true);
    expect(filterConversations(conversations, filters, lookup, { ignoreQueue: true })).toHaveLength(conversations.length);
  });

  it("ordena pela urgência de supervisão", () => {
    const sorted = sortConversations(conversations, "prioridade");
    expect(sorted[0].state).toBe("agent_error");
    expect(sorted[1].state).toBe("needs_review");
    expect(sorted[1].priority).toBe("urgente");
    expect(sorted.at(-1)!.state === "resolved" || sorted.at(-1)!.state === "auto_resolved").toBe(true);
  });

  it("ordena pelo SLA mais próximo, deixando pausados e resolvidos no fim", () => {
    const sorted = sortConversations(conversations, "sla");
    expect(sorted[0].id).toBe("cv-07");
    expect(sorted.at(-1)!.slaPaused || ticketStatus(sorted.at(-1)!.state) === "resolvido" || !sorted.at(-1)!.slaDueAt).toBe(true);
  });
});

describe("clientes e pedidos", () => {
  it("calcula total do pedido com frete e desconto", () => {
    const o = orders.find((x) => x.id === "TO5531")!;
    expect(orderTotal(o)).toBe(803.8);
  });

  it("calcula estatísticas do cliente descontando reembolsos e cancelados", () => {
    const renata = customers.find((c) => c.id === "cu-18")!;
    const stats = customerStats(renata, orders, conversations);
    expect(stats.ordersCount).toBe(3);
    expect(stats.totalSpent).toBe(289 + 161.82 + 83.8);

    const sofia = customers.find((c) => c.id === "cu-15")!;
    expect(customerStats(sofia, orders, conversations).totalSpent).toBe(0);
  });
});

describe("visões de conversas", () => {
  const ctx = { currentUserId: "u-marina", currentUserFirstName: "Marina" };
  const ids = (view: Parameters<typeof inView>[1]) => conversations.filter((c) => inView(c, view, ctx)).map((c) => c.id);

  it("separa os canais sem sobreposição", () => {
    const whatsapp = ids({ kind: "canal", channel: "whatsapp", folder: "todas" });
    const email = ids({ kind: "canal", channel: "email", folder: "todas" });
    expect(whatsapp.length + email.length).toBe(conversations.length);
    expect(whatsapp.filter((id) => email.includes(id))).toEqual([]);
  });

  it("menções vêm de notas com @nome de quem está usando", () => {
    expect(ids({ kind: "mencoes" })).toEqual(["cv-02"]);
  });

  it("participando inclui atribuídas e conversas com nota própria", () => {
    expect(ids({ kind: "participando" }).sort()).toEqual(["cv-08", "cv-11"]);
  });

  it("não atribuídas são as que esperam uma pessoa sem responsável", () => {
    for (const id of ids({ kind: "nao-atribuidas" })) {
      const c = byId(id);
      expect(c.assigneeId, id).toBeNull();
      expect(["needs_review", "agent_error", "agent_paused"], id).toContain(c.state);
    }
  });

  it("pastas do canal: não lidas, aguardando resposta e resolvidas", () => {
    for (const id of ids({ kind: "canal", channel: "email", folder: "nao-lidas" })) expect(byId(id).unreadCount, id).toBeGreaterThan(0);
    for (const id of ids({ kind: "canal", channel: "whatsapp", folder: "resolvidas" })) {
      expect(["auto_resolved", "resolved"], id).toContain(byId(id).state);
    }
    for (const id of ids({ kind: "canal", channel: "whatsapp", folder: "aguardando" })) {
      const c = byId(id);
      const last = c.timeline.filter((t) => t.type === "message").at(-1);
      expect(last?.type === "message" && last.author, id).toBe("customer");
    }
  });

  it("abas de supervisão só aparecem nas visões completas", () => {
    expect(viewHasQueues({ kind: "todas" })).toBe(true);
    expect(viewHasQueues({ kind: "canal", channel: "email", folder: "todas" })).toBe(true);
    expect(viewHasQueues({ kind: "canal", channel: "email", folder: "nao-lidas" })).toBe(false);
    expect(viewHasQueues({ kind: "mencoes" })).toBe(false);
  });
});
