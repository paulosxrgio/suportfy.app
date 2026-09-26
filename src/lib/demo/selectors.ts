import { DEMO_NOW, formatDuration, matchesQuery, minutesFromNow } from "@/lib/format";
import { priorityMeta } from "./labels";
import type {
  Channel,
  Conversation,
  ConversationState,
  Customer,
  Order,
  Priority,
  StoreFilter,
  TicketStatus,
} from "./types";

/** Status de ticket derivado do estado da conversa. */
export function ticketStatus(state: ConversationState): TicketStatus {
  switch (state) {
    case "awaiting_customer":
    case "awaiting_order_info":
      return "pendente";
    case "auto_resolved":
    case "resolved":
      return "resolvido";
    default:
      return "aberto";
  }
}

export type SlaStatus = "ok" | "risco" | "vencido" | "pausado" | "cumprido" | "nenhum";

export interface SlaInfo {
  status: SlaStatus;
  label: string;
  short: string;
}

const SLA_RISK_MINUTES = 30;

export function slaInfo(conversation: Pick<Conversation, "state" | "slaDueAt" | "slaPaused">): SlaInfo {
  if (ticketStatus(conversation.state) === "resolvido") {
    return { status: "cumprido", label: "SLA cumprido", short: "Cumprido" };
  }
  if (conversation.slaPaused) {
    return { status: "pausado", label: "SLA pausado enquanto aguarda o cliente", short: "Pausado" };
  }
  if (!conversation.slaDueAt) return { status: "nenhum", label: "Sem SLA definido", short: "—" };
  const minutes = minutesFromNow(conversation.slaDueAt);
  if (minutes < 0) {
    const late = formatDuration(-minutes);
    return { status: "vencido", label: `SLA vencido há ${late}`, short: `Vencido · ${late}` };
  }
  const left = formatDuration(minutes);
  if (minutes <= SLA_RISK_MINUTES) {
    return { status: "risco", label: `SLA vence em ${left}`, short: left };
  }
  return { status: "ok", label: `SLA vence em ${left}`, short: left };
}

/** Filas da Inbox, orientadas à supervisão do agente. */
export type InboxQueue = "revisao" | "ia" | "equipe" | "resolvidas" | "todas";

export const queueStates: Record<Exclude<InboxQueue, "todas">, ConversationState[]> = {
  revisao: ["needs_review", "agent_error"],
  ia: ["ai_active", "awaiting_customer", "awaiting_order_info"],
  equipe: ["human_assigned", "agent_paused"],
  resolvidas: ["auto_resolved", "resolved"],
};

export function inQueue(conversation: Conversation, queue: InboxQueue): boolean {
  if (queue === "todas") return true;
  return queueStates[queue].includes(conversation.state);
}

export type AssigneeFilter = "ai" | "me" | "unassigned" | string;

export interface InboxFilters {
  query: string;
  queue: InboxQueue;
  states: ConversationState[];
  channels: Channel[];
  stores: string[];
  assignees: AssigneeFilter[];
  priorities: Priority[];
  unreadOnly: boolean;
}

export const emptyInboxFilters: InboxFilters = {
  query: "",
  queue: "todas",
  states: [],
  channels: [],
  stores: [],
  assignees: [],
  priorities: [],
  unreadOnly: false,
};

export function isAiHandled(conversation: Conversation): boolean {
  return queueStates.ia.includes(conversation.state) || conversation.state === "auto_resolved";
}

export function matchesAssignee(conversation: Conversation, filter: AssigneeFilter, currentUserId: string): boolean {
  if (filter === "ai") return conversation.assigneeId === null && isAiHandled(conversation);
  if (filter === "me") return conversation.assigneeId === currentUserId;
  if (filter === "unassigned") return conversation.assigneeId === null && !isAiHandled(conversation);
  return conversation.assigneeId === filter;
}

export function filterConversations(
  conversations: Conversation[],
  filters: InboxFilters,
  lookup: { customerName: (id: string) => string; currentUserId: string },
  options: { ignoreQueue?: boolean } = {},
): Conversation[] {
  return conversations.filter((c) => {
    if (!options.ignoreQueue && !inQueue(c, filters.queue)) return false;
    if (filters.states.length && !filters.states.includes(c.state)) return false;
    if (filters.channels.length && !filters.channels.includes(c.channel)) return false;
    if (filters.stores.length && !filters.stores.includes(c.storeId)) return false;
    if (filters.priorities.length && !filters.priorities.includes(c.priority)) return false;
    if (filters.unreadOnly && c.unreadCount === 0) return false;
    if (
      filters.assignees.length &&
      !filters.assignees.some((a) => matchesAssignee(c, a, lookup.currentUserId))
    ) {
      return false;
    }
    if (filters.query) {
      const lastMessage = [...c.timeline].reverse().find((t) => t.type === "message");
      return matchesQuery(
        filters.query,
        lookup.customerName(c.customerId),
        c.subject,
        `#${c.ticketNumber}`,
        c.orderIds.map((o) => `#${o}`).join(" "),
        c.tags.join(" "),
        lastMessage?.type === "message" ? lastMessage.body : "",
      );
    }
    return true;
  });
}

export type InboxSort = "recentes" | "sla" | "prioridade";

const stateUrgency: Record<ConversationState, number> = {
  agent_error: 0,
  needs_review: 1,
  agent_paused: 2,
  human_assigned: 3,
  ai_active: 4,
  awaiting_order_info: 5,
  awaiting_customer: 6,
  auto_resolved: 7,
  resolved: 8,
};

export function sortConversations(conversations: Conversation[], sort: InboxSort): Conversation[] {
  const byRecent = (a: Conversation, b: Conversation) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt);
  const list = [...conversations];
  if (sort === "recentes") return list.sort(byRecent);
  if (sort === "sla") {
    const due = (c: Conversation) =>
      c.slaPaused || !c.slaDueAt || ticketStatus(c.state) === "resolvido" ? Number.POSITIVE_INFINITY : Date.parse(c.slaDueAt);
    return list.sort((a, b) => due(a) - due(b) || byRecent(a, b));
  }
  return list.sort(
    (a, b) =>
      stateUrgency[a.state] - stateUrgency[b.state] ||
      priorityMeta[a.priority].rank - priorityMeta[b.priority].rank ||
      byRecent(a, b),
  );
}

export function scopeByStore<T extends { storeId: string }>(items: T[], store: StoreFilter): T[] {
  return store === "all" ? items : items.filter((i) => i.storeId === store);
}

export function orderTotal(order: Order): number {
  const subtotal = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  return Math.round((subtotal + order.shipping - order.discount) * 100) / 100;
}

export function orderSubtotal(order: Order): number {
  return order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

export interface CustomerStats {
  ordersCount: number;
  totalSpent: number;
  conversationsCount: number;
  lastActivityAt: string;
}

export function customerStats(customer: Customer, orders: Order[], conversations: Conversation[]): CustomerStats {
  const own = orders.filter((o) => o.customerId === customer.id);
  const spent = own
    .filter((o) => o.status !== "cancelado")
    .reduce((sum, o) => sum + orderTotal(o) - o.refunded, 0);
  const convs = conversations.filter((c) => c.customerId === customer.id);
  const last = [customer.lastActivityAt, ...convs.map((c) => c.lastActivityAt)].sort().at(-1) ?? customer.lastActivityAt;
  return {
    ordersCount: own.length,
    totalSpent: Math.round(spent * 100) / 100,
    conversationsCount: convs.length,
    lastActivityAt: last,
  };
}

export function isToday(iso: string): boolean {
  const day = 24 * 60 * 60 * 1000;
  const offset = -3 * 60 * 60 * 1000;
  return Math.floor((Date.parse(iso) + offset) / day) === Math.floor((DEMO_NOW + offset) / day);
}

/* ---------- Visões da navegação de conversas ---------- */

/** Recortes de um canal, no mesmo espírito das pastas do menu lateral. */
export type ChannelFolder = "todas" | "nao-lidas" | "aguardando" | "resolvidas";

export type InboxView =
  | { kind: "todas" }
  | { kind: "mencoes" }
  | { kind: "participando" }
  | { kind: "nao-atribuidas" }
  | { kind: "canal"; channel: Channel; folder: ChannelFolder };

export interface ViewContext {
  currentUserId: string;
  /** Primeiro nome de quem está usando, para reconhecer "@Nome" nas notas. */
  currentUserFirstName: string;
}

const RESOLVED_STATES: ConversationState[] = ["auto_resolved", "resolved"];
/** Estados em que a conversa espera uma pessoa e ninguém da equipe a assumiu. */
const NEEDS_HUMAN_STATES: ConversationState[] = ["needs_review", "agent_error", "agent_paused"];

export function isResolved(conversation: Conversation): boolean {
  return RESOLVED_STATES.includes(conversation.state);
}

export function mentionsUser(conversation: Conversation, firstName: string): boolean {
  const pattern = new RegExp(`@${firstName}\\b`, "i");
  return conversation.timeline.some((t) => t.type === "note" && pattern.test(t.body));
}

/** Atribuída a quem está usando, ou com mensagem ou nota escrita por essa pessoa. */
export function isParticipating(conversation: Conversation, userId: string): boolean {
  if (conversation.assigneeId === userId) return true;
  return conversation.timeline.some(
    (t) => (t.type === "note" && t.authorId === userId) || (t.type === "message" && t.author === "agent" && t.authorId === userId),
  );
}

/** O cliente escreveu por último e a conversa não foi resolvida: alguém (IA ou equipe) deve responder. */
export function isAwaitingReply(conversation: Conversation): boolean {
  if (isResolved(conversation)) return false;
  const last = [...conversation.timeline].reverse().find((t) => t.type === "message");
  return last?.type === "message" && last.author === "customer";
}

export function inView(conversation: Conversation, view: InboxView, ctx: ViewContext): boolean {
  switch (view.kind) {
    case "todas":
      return true;
    case "mencoes":
      return mentionsUser(conversation, ctx.currentUserFirstName);
    case "participando":
      return isParticipating(conversation, ctx.currentUserId);
    case "nao-atribuidas":
      return conversation.assigneeId === null && NEEDS_HUMAN_STATES.includes(conversation.state);
    case "canal": {
      if (conversation.channel !== view.channel) return false;
      switch (view.folder) {
        case "todas":
          return true;
        case "nao-lidas":
          return conversation.unreadCount > 0;
        case "aguardando":
          return isAwaitingReply(conversation);
        case "resolvidas":
          return isResolved(conversation);
      }
    }
  }
}

/** Visões em que as abas de supervisão (Revisão, Com a IA, Equipe, Todas) fazem sentido. */
export function viewHasQueues(view: InboxView): boolean {
  return view.kind === "todas" || (view.kind === "canal" && view.folder === "todas");
}
