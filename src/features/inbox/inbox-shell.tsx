"use client";

import { useParams } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  emptyInboxFilters,
  filterConversations,
  inQueue,
  inView,
  sortConversations,
  viewHasQueues,
  type InboxFilters,
  type InboxQueue,
  type InboxSort,
  type InboxView,
} from "@/lib/demo/selectors";
import { CURRENT_USER_ID, useDataset } from "@/lib/demo/store";
import type { Conversation } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";
import { useViewContext } from "./use-views";
import { conversationPath, parseInboxPath, viewPath } from "./views";

interface InboxContextValue {
  view: InboxView;
  /** Mostra as abas de supervisão (Revisão, Com a IA, Equipe, Todas). */
  hasQueues: boolean;
  filters: InboxFilters;
  setFilters: (update: (f: InboxFilters) => InboxFilters) => void;
  sort: InboxSort;
  setSort: (sort: InboxSort) => void;
  visible: Conversation[];
  /** Conversas da visão que passam pelos filtros, ignorando a aba selecionada (para as contagens). */
  filteredAll: Conversation[];
  selectedId?: string;
  listHref: string;
  hrefFor: (id: string) => string;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox precisa estar dentro da Inbox.");
  return ctx;
}

export function InboxShell({ children }: { children: ReactNode }) {
  const params = useParams<{ slug?: string[] }>();
  const path = (params?.slug ?? []).join("/");
  const route = useMemo(() => parseInboxPath(path ? path.split("/") : []), [path]);
  const view: InboxView = useMemo(() => route?.view ?? { kind: "todas" }, [route]);
  const selectedId = route?.conversationId;
  const { conversations, allCustomers } = useDataset();
  const viewCtx = useViewContext();

  // Abre na aba de revisão, exceto quando a conversa aberta pelo link está fora dela.
  const [filters, setFiltersState] = useState<InboxFilters>(() => {
    const selected = conversations.find((c) => c.id === selectedId);
    const hasReview = conversations.some((c) => inQueue(c, "revisao"));
    const queue: InboxQueue = hasReview && (!selected || inQueue(selected, "revisao")) ? "revisao" : "todas";
    return { ...emptyInboxFilters, queue };
  });
  const [sort, setSort] = useState<InboxSort>("prioridade");

  const value = useMemo<InboxContextValue>(() => {
    const lookup = {
      customerName: (id: string) => allCustomers.find((c) => c.id === id)?.name ?? "",
      currentUserId: CURRENT_USER_ID,
    };
    const hasQueues = viewHasQueues(view);
    const inside = conversations.filter((c) => inView(c, view, viewCtx));
    const filteredAll = filterConversations(inside, filters, lookup, { ignoreQueue: true });
    const visible = sortConversations(
      hasQueues ? filteredAll.filter((c) => inQueue(c, filters.queue)) : filteredAll,
      sort,
    );
    return {
      view,
      hasQueues,
      filters,
      setFilters: (update) => setFiltersState(update),
      sort,
      setSort,
      visible,
      filteredAll,
      selectedId,
      listHref: viewPath(view),
      hrefFor: (id) => conversationPath(view, id),
    };
  }, [allCustomers, conversations, filters, sort, selectedId, view, viewCtx]);

  return (
    <InboxContext.Provider value={value}>
      <div className="flex h-full min-h-0">
        <div
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-r border-line bg-surface lg:flex lg:w-[340px] xl:w-[360px]",
            selectedId ? "hidden" : "flex",
          )}
        >
          <ConversationList />
        </div>
        <div className={cn("min-h-0 min-w-0 flex-1 bg-canvas lg:flex", selectedId ? "flex" : "hidden")}>{children}</div>
      </div>
    </InboxContext.Provider>
  );
}
