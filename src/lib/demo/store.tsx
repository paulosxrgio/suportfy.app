"use client";

/**
 * Estado da demonstração, mantido apenas em memória no navegador.
 *
 * Ações como assumir conversa, pausar a IA ou publicar conteúdo alteram só
 * esta cópia local e somem ao recarregar a página. Nada é enviado para
 * servidores, Shopify, WhatsApp, e-mail ou modelos de IA.
 */
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { demoNowIso } from "@/lib/format";
import {
  automations as seedAutomations,
  conversations as seedConversations,
  customers as seedCustomers,
  CURRENT_USER_ID,
  initialAgentConfig,
  initialAudit,
  knowledgeItems as seedKnowledge,
  members as seedMembers,
  messageTemplates as seedTemplates,
  orders as seedOrders,
  quickReplies as seedQuickReplies,
  stores,
  tagDefinitions as seedTags,
  teams,
} from "./data";
import { priorityMeta } from "./labels";
import { scopeByStore } from "./selectors";
import type {
  AgentConfig,
  AgentMode,
  Attachment,
  AuditEntry,
  Automation,
  Channel,
  Conversation,
  ConversationState,
  Customer,
  KnowledgeItem,
  KnowledgeStatus,
  Member,
  MessageTemplate,
  Priority,
  QuickReply,
  StoreFilter,
  TagDefinition,
  TimelineItem,
} from "./types";

export type DataMode = "demo" | "empty";
export type Simulation = "none" | "loading" | "error";

interface DemoState {
  dataMode: DataMode;
  simulation: Simulation;
  store: StoreFilter;
  sidebarCollapsed: boolean;
  conversations: Conversation[];
  customers: Customer[];
  knowledge: KnowledgeItem[];
  automations: Automation[];
  members: Member[];
  quickReplies: QuickReply[];
  tags: TagDefinition[];
  templates: MessageTemplate[];
  agent: AgentConfig;
  audit: AuditEntry[];
}

function createInitialState(): DemoState {
  return {
    dataMode: "demo",
    simulation: "none",
    store: "all",
    sidebarCollapsed: false,
    conversations: seedConversations,
    customers: seedCustomers,
    knowledge: seedKnowledge,
    automations: seedAutomations,
    members: seedMembers,
    quickReplies: seedQuickReplies,
    tags: seedTags,
    templates: seedTemplates,
    agent: initialAgentConfig,
    audit: initialAudit,
  };
}

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter}`;
}

type Action =
  | { type: "setDataMode"; mode: DataMode }
  | { type: "setSimulation"; simulation: Simulation }
  | { type: "setStore"; store: StoreFilter }
  | { type: "setSidebarCollapsed"; collapsed: boolean }
  | { type: "reset" }
  | { type: "conversation"; id: string; update: (c: Conversation) => Conversation; audit?: string }
  | { type: "agent"; update: (a: AgentConfig) => AgentConfig; audit?: { action: string; target: string } }
  | { type: "customerNote"; customerId: string; body: string }
  | { type: "knowledge"; update: (items: KnowledgeItem[]) => KnowledgeItem[]; audit: { action: string; target: string } }
  | { type: "automations"; update: (items: Automation[]) => Automation[]; audit: { action: string; target: string } }
  | { type: "members"; update: (items: Member[]) => Member[]; audit: { action: string; target: string } }
  | { type: "quickReplies"; update: (items: QuickReply[]) => QuickReply[]; audit: { action: string; target: string } }
  | { type: "tags"; update: (items: TagDefinition[]) => TagDefinition[]; audit: { action: string; target: string } }
  | { type: "templates"; update: (items: MessageTemplate[]) => MessageTemplate[]; audit: { action: string; target: string } }
  | { type: "audit"; action: string; target: string };

function withAudit(state: DemoState, action: string, target: string): AuditEntry[] {
  return [{ id: uid("audit"), at: demoNowIso(), actorId: CURRENT_USER_ID, action, target }, ...state.audit];
}

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "setDataMode":
      return { ...state, dataMode: action.mode };
    case "setSimulation":
      return { ...state, simulation: action.simulation };
    case "setStore":
      return { ...state, store: action.store };
    case "setSidebarCollapsed":
      return { ...state, sidebarCollapsed: action.collapsed };
    case "reset":
      return { ...createInitialState(), sidebarCollapsed: state.sidebarCollapsed };
    case "conversation": {
      const current = state.conversations.find((c) => c.id === action.id);
      if (!current) return state;
      const next = action.update(current);
      if (next === current) return state;
      const customer = state.customers.find((c) => c.id === current.customerId);
      return {
        ...state,
        conversations: state.conversations.map((c) => (c.id === action.id ? next : c)),
        audit: action.audit
          ? withAudit(state, action.audit, `Ticket #${current.ticketNumber} · ${customer?.name ?? "Cliente"}`)
          : state.audit,
      };
    }
    case "agent":
      return {
        ...state,
        agent: action.update(state.agent),
        audit: action.audit ? withAudit(state, action.audit.action, action.audit.target) : state.audit,
      };
    case "customerNote": {
      const customer = state.customers.find((c) => c.id === action.customerId);
      return {
        ...state,
        customers: state.customers.map((c) =>
          c.id === action.customerId
            ? {
                ...c,
                notes: [{ id: uid("note"), authorId: CURRENT_USER_ID, at: demoNowIso(), body: action.body }, ...c.notes],
              }
            : c,
        ),
        audit: withAudit(state, "Adicionou observação ao cliente", customer?.name ?? "Cliente"),
      };
    }
    case "knowledge":
      return { ...state, knowledge: action.update(state.knowledge), audit: withAudit(state, action.audit.action, action.audit.target) };
    case "automations":
      return {
        ...state,
        automations: action.update(state.automations),
        audit: withAudit(state, action.audit.action, action.audit.target),
      };
    case "members":
      return { ...state, members: action.update(state.members), audit: withAudit(state, action.audit.action, action.audit.target) };
    case "quickReplies":
      return {
        ...state,
        quickReplies: action.update(state.quickReplies),
        audit: withAudit(state, action.audit.action, action.audit.target),
      };
    case "tags":
      return { ...state, tags: action.update(state.tags), audit: withAudit(state, action.audit.action, action.audit.target) };
    case "templates":
      return {
        ...state,
        templates: action.update(state.templates),
        audit: withAudit(state, action.audit.action, action.audit.target),
      };
    case "audit":
      return { ...state, audit: withAudit(state, action.action, action.target) };
  }
}

function event(kind: Extract<TimelineItem, { type: "event" }>["kind"], text: string, detail?: string): TimelineItem {
  return { id: uid("ev"), type: "event", kind, at: demoNowIso(), text, detail };
}

function append(c: Conversation, ...items: TimelineItem[]): Conversation {
  return { ...c, timeline: [...c.timeline, ...items], lastActivityAt: items.at(-1)?.at ?? c.lastActivityAt };
}

function lastMessageAuthor(c: Conversation) {
  const last = [...c.timeline].reverse().find((t) => t.type === "message");
  return last?.type === "message" ? last.author : undefined;
}

function useDemoActions(dispatch: React.Dispatch<Action>, state: DemoState) {
  const memberName = useCallback(
    (id: string) => state.members.find((m) => m.id === id)?.name ?? "Pessoa da equipe",
    [state.members],
  );

  return useMemo(() => {
    const conv = (id: string, update: (c: Conversation) => Conversation, audit?: string) =>
      dispatch({ type: "conversation", id, update, audit });

    return {
      setDataMode: (mode: DataMode) => dispatch({ type: "setDataMode", mode }),
      setSimulation: (simulation: Simulation) => dispatch({ type: "setSimulation", simulation }),
      setStore: (store: StoreFilter) => dispatch({ type: "setStore", store }),
      setSidebarCollapsed: (collapsed: boolean) => dispatch({ type: "setSidebarCollapsed", collapsed }),
      reset: () => dispatch({ type: "reset" }),
      log: (action: string, target: string) => dispatch({ type: "audit", action, target }),

      markRead: (id: string) => conv(id, (c) => (c.unreadCount ? { ...c, unreadCount: 0 } : c)),

      assume: (id: string) =>
        conv(
          id,
          (c) =>
            append(
              { ...c, state: "human_assigned", assigneeId: CURRENT_USER_ID, unreadCount: 0 },
              event("assigned", "Você assumiu a conversa", "A IA fica pausada nesta conversa enquanto você conduz."),
            ),
          "Assumiu a conversa",
        ),

      pauseAi: (id: string) =>
        conv(
          id,
          (c) =>
            append(
              { ...c, state: "agent_paused", pausedBy: CURRENT_USER_ID },
              event("paused", "Você pausou a IA nesta conversa", "A IA não responde até ser retomada."),
            ),
          "Pausou a IA na conversa",
        ),

      returnToAi: (id: string) =>
        conv(
          id,
          (c) => {
            const next: ConversationState = lastMessageAuthor(c) === "customer" ? "ai_active" : "awaiting_customer";
            return append(
              { ...c, state: next, assigneeId: null, pausedBy: undefined, error: undefined },
              event("returned_to_ai", "Você devolveu a conversa ao agente de IA", "A IA volta a conduzir o atendimento."),
            );
          },
          "Devolveu a conversa à IA",
        ),

      transfer: (id: string, target: { memberId?: string; teamId?: string }, note?: string) =>
        conv(
          id,
          (c) => {
            const items: TimelineItem[] = [];
            let updated: Conversation;
            if (target.memberId) {
              const name = target.memberId === CURRENT_USER_ID ? "você" : memberName(target.memberId);
              updated = { ...c, state: "human_assigned", assigneeId: target.memberId };
              items.push(event("transferred", `Conversa transferida para ${name}`));
            } else {
              const team = teams.find((t) => t.id === target.teamId);
              updated = { ...c, state: "needs_review", assigneeId: null, teamId: target.teamId };
              items.push(event("transferred", `Conversa transferida para a equipe ${team?.name ?? ""}`.trim()));
            }
            if (note?.trim()) {
              items.push({ id: uid("note"), type: "note", authorId: CURRENT_USER_ID, at: demoNowIso(), body: note.trim() });
            }
            return append(updated, ...items);
          },
          "Transferiu a conversa",
        ),

      resolve: (id: string) =>
        conv(
          id,
          (c) =>
            append(
              { ...c, state: "resolved", unreadCount: 0, assigneeId: c.assigneeId ?? CURRENT_USER_ID },
              event("resolved", "Você resolveu a conversa"),
            ),
          "Resolveu a conversa",
        ),

      reopen: (id: string) =>
        conv(
          id,
          (c) =>
            append(
              { ...c, state: c.assigneeId ? "human_assigned" : "needs_review" },
              event("reopened", "Você reabriu a conversa"),
            ),
          "Reabriu a conversa",
        ),

      sendReply: (id: string, body: string, attachments: Attachment[] = [], channel?: Channel) =>
        conv(
          id,
          (c) =>
            append(c, {
              id: uid("msg"),
              type: "message",
              author: "agent",
              authorId: CURRENT_USER_ID,
              at: demoNowIso(),
              body,
              delivery: "demo",
              attachments: attachments.length ? attachments : undefined,
              channel: channel && channel !== c.channel ? channel : undefined,
            }),
          "Adicionou resposta (não enviada, demonstração)",
        ),

      addNote: (id: string, body: string) =>
        conv(
          id,
          (c) => append(c, { id: uid("note"), type: "note", authorId: CURRENT_USER_ID, at: demoNowIso(), body }),
          "Adicionou nota interna",
        ),

      approveDraft: (id: string, body: string) =>
        conv(
          id,
          (c) =>
            append(
              { ...c, aiDraft: undefined, state: "awaiting_customer", slaPaused: true },
              {
                id: uid("msg"),
                type: "message",
                author: "ai",
                at: demoNowIso(),
                body,
                delivery: "demo",
                approvedBy: CURRENT_USER_ID,
                sources: c.aiDraft?.sources,
              },
            ),
          "Aprovou resposta da IA (não enviada, demonstração)",
        ),

      discardDraft: (id: string) =>
        conv(
          id,
          (c) =>
            append(
              { ...c, aiDraft: undefined },
              event("draft", "Você descartou a resposta preparada pela IA", "Nada foi enviado ao cliente."),
            ),
          "Descartou resposta da IA",
        ),

      flagAiMessage: (id: string, messageId: string) =>
        conv(
          id,
          (c) => ({
            ...c,
            timeline: c.timeline.map((t) => (t.id === messageId && t.type === "message" ? { ...t, flagged: true } : t)),
          }),
          "Sinalizou resposta da IA para revisão",
        ),

      setPriority: (id: string, priority: Priority) =>
        conv(id, (c) => append({ ...c, priority }, event("classified", `Prioridade alterada para ${priorityMeta[priority].label.toLowerCase()}`)), "Alterou a prioridade"),

      toggleTag: (id: string, tag: string) =>
        conv(
          id,
          (c) => ({ ...c, tags: c.tags.includes(tag) ? c.tags.filter((t) => t !== tag) : [...c.tags, tag] }),
          "Alterou as tags",
        ),

      addCustomerNote: (customerId: string, body: string) => dispatch({ type: "customerNote", customerId, body }),

      updateAgent: (update: (a: AgentConfig) => AgentConfig, audit?: { action: string; target: string }) =>
        dispatch({ type: "agent", update, audit }),

      setChannelMode: (storeId: string, channel: Channel, mode: AgentMode) =>
        dispatch({
          type: "agent",
          update: (a) => ({
            ...a,
            channels: { ...a.channels, [storeId]: { ...a.channels[storeId], [channel]: { ...a.channels[storeId][channel], mode } } },
          }),
          audit: {
            action: "Alterou o modo do agente",
            target: `${stores.find((s) => s.id === storeId)?.name ?? storeId} · ${channel === "whatsapp" ? "WhatsApp" : "E-mail"}`,
          },
        }),

      toggleChannelPause: (storeId: string, channel: Channel) =>
        dispatch({
          type: "agent",
          update: (a) => ({
            ...a,
            channels: {
              ...a.channels,
              [storeId]: {
                ...a.channels[storeId],
                [channel]: { ...a.channels[storeId][channel], paused: !a.channels[storeId][channel].paused },
              },
            },
          }),
          audit: {
            action: "Pausou ou retomou o agente no canal",
            target: `${stores.find((s) => s.id === storeId)?.name ?? storeId} · ${channel === "whatsapp" ? "WhatsApp" : "E-mail"}`,
          },
        }),

      setOrgPaused: (paused: boolean) =>
        dispatch({
          type: "agent",
          update: (a) => ({ ...a, orgPaused: paused }),
          audit: { action: paused ? "Pausou o agente na organização" : "Retomou o agente na organização", target: "Agente de IA" },
        }),

      setKnowledgeStatus: (id: string, status: KnowledgeStatus) =>
        dispatch({
          type: "knowledge",
          update: (items) =>
            items.map((k) =>
              k.id === id ? { ...k, status, updatedAt: demoNowIso(), updatedBy: CURRENT_USER_ID } : k,
            ),
          audit: {
            action:
              status === "publicado" ? "Publicou conteúdo" : status === "arquivado" ? "Arquivou conteúdo" : "Voltou conteúdo para rascunho",
            target: state.knowledge.find((k) => k.id === id)?.title ?? "Conteúdo",
          },
        }),

      saveKnowledge: (item: KnowledgeItem, isNew: boolean) =>
        dispatch({
          type: "knowledge",
          update: (items) => (isNew ? [item, ...items] : items.map((k) => (k.id === item.id ? item : k))),
          audit: { action: isNew ? "Criou conteúdo" : "Salvou nova versão de conteúdo", target: item.title },
        }),

      saveAutomation: (automation: Automation, isNew: boolean) =>
        dispatch({
          type: "automations",
          update: (items) => (isNew ? [automation, ...items] : items.map((a) => (a.id === automation.id ? automation : a))),
          audit: { action: isNew ? "Criou automação" : "Editou automação", target: automation.name },
        }),

      toggleAutomation: (id: string) =>
        dispatch({
          type: "automations",
          update: (items) =>
            items.map((a) => (a.id === id ? { ...a, state: a.state === "ativa" ? "pausada" : "ativa" } : a)),
          audit: { action: "Ativou ou pausou automação", target: state.automations.find((a) => a.id === id)?.name ?? "Automação" },
        }),

      deleteAutomation: (id: string) =>
        dispatch({
          type: "automations",
          update: (items) => items.filter((a) => a.id !== id),
          audit: { action: "Excluiu automação", target: state.automations.find((a) => a.id === id)?.name ?? "Automação" },
        }),

      inviteMember: (member: Omit<Member, "id" | "status" | "invitedAt">) =>
        dispatch({
          type: "members",
          update: (items) => [...items, { ...member, id: uid("u"), status: "convite_pendente", invitedAt: demoNowIso() }],
          audit: { action: "Registrou convite (não enviado)", target: member.email },
        }),

      updateMember: (id: string, patch: Partial<Member>) =>
        dispatch({
          type: "members",
          update: (items) => items.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          audit: { action: "Alterou acesso de membro", target: memberName(id) },
        }),

      resendInvite: (id: string) =>
        dispatch({
          type: "members",
          update: (items) => items.map((m) => (m.id === id ? { ...m, status: "convite_pendente", invitedAt: demoNowIso() } : m)),
          audit: { action: "Registrou reenvio de convite (não enviado)", target: memberName(id) },
        }),

      removeMember: (id: string) =>
        dispatch({
          type: "members",
          update: (items) => items.filter((m) => m.id !== id),
          audit: { action: "Removeu membro", target: memberName(id) },
        }),

      saveQuickReply: (reply: QuickReply, isNew: boolean) =>
        dispatch({
          type: "quickReplies",
          update: (items) => (isNew ? [...items, reply] : items.map((r) => (r.id === reply.id ? reply : r))),
          audit: { action: isNew ? "Criou resposta rápida" : "Editou resposta rápida", target: reply.shortcut },
        }),

      deleteQuickReply: (id: string) =>
        dispatch({
          type: "quickReplies",
          update: (items) => items.filter((r) => r.id !== id),
          audit: { action: "Excluiu resposta rápida", target: state.quickReplies.find((r) => r.id === id)?.shortcut ?? "" },
        }),

      saveTag: (tag: TagDefinition, isNew: boolean) =>
        dispatch({
          type: "tags",
          update: (items) => (isNew ? [...items, tag] : items.map((t) => (t.id === tag.id ? tag : t))),
          audit: { action: isNew ? "Criou tag" : "Editou tag", target: tag.name },
        }),

      deleteTag: (id: string) =>
        dispatch({
          type: "tags",
          update: (items) => items.filter((t) => t.id !== id),
          audit: { action: "Excluiu tag", target: state.tags.find((t) => t.id === id)?.name ?? "" },
        }),

      saveTemplate: (template: MessageTemplate, isNew: boolean) =>
        dispatch({
          type: "templates",
          update: (items) => (isNew ? [...items, template] : items.map((t) => (t.id === template.id ? template : t))),
          audit: { action: isNew ? "Criou template" : "Editou template", target: template.name },
        }),

      deleteTemplate: (id: string) =>
        dispatch({
          type: "templates",
          update: (items) => items.filter((t) => t.id !== id),
          audit: { action: "Excluiu template", target: state.templates.find((t) => t.id === id)?.name ?? "" },
        }),

      newId: uid,
    };
  }, [dispatch, memberName, state.automations, state.knowledge, state.quickReplies, state.tags, state.templates]);
}

type DemoActions = ReturnType<typeof useDemoActions>;

interface DemoContextValue {
  state: DemoState;
  actions: DemoActions;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const actions = useDemoActions(dispatch, state);
  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo precisa estar dentro de <DemoProvider>.");
  return ctx;
}

/**
 * Coleções visíveis conforme o modo de dados e a loja selecionada.
 * No modo "conta sem dados" as listas voltam vazias, como numa conta nova.
 */
export function useDataset() {
  const { state } = useDemo();
  return useMemo(() => {
    const empty = state.dataMode === "empty";
    const scope = <T extends { storeId: string }>(items: T[]) => (empty ? [] : scopeByStore(items, state.store));
    const members = empty ? state.members.filter((m) => m.id === CURRENT_USER_ID) : state.members;
    return {
      isEmpty: empty,
      store: state.store,
      conversations: scope(state.conversations),
      allConversations: empty ? [] : state.conversations,
      customers: scope(state.customers),
      allCustomers: empty ? [] : state.customers,
      orders: scope(seedOrders),
      allOrders: empty ? [] : seedOrders,
      knowledge: empty
        ? []
        : state.knowledge.filter(
            (k) => state.store === "all" || k.storeIds === "all" || k.storeIds.includes(state.store),
          ),
      allKnowledge: empty ? [] : state.knowledge,
      automations: empty
        ? []
        : state.automations.filter((a) => state.store === "all" || a.storeId === "all" || a.storeId === state.store),
      members,
      quickReplies: empty ? [] : state.quickReplies,
      tags: empty ? [] : state.tags,
      templates: empty ? [] : state.templates,
      audit: empty ? [] : state.audit,
      agent: state.agent,
    };
  }, [state]);
}

export { CURRENT_USER_ID, stores, teams };
