"use client";

import { useParams } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  emptyInboxFilters,
  filterConversations,
  inQueue,
  sortConversations,
  type InboxFilters,
  type InboxQueue,
  type InboxSort,
} from "@/lib/demo/selectors";
import { CURRENT_USER_ID, useDataset } from "@/lib/demo/store";
import type { Conversation } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";

interface InboxContextValue {
  filters: InboxFilters;
  setFilters: (update: (f: InboxFilters) => InboxFilters) => void;
  sort: InboxSort;
  setSort: (sort: InboxSort) => void;
  visible: Conversation[];
  /** Conversas que passam pelos filtros, ignorando a fila selecionada (para as contagens). */
  filteredAll: Conversation[];
  selectedId?: string;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox precisa estar dentro da Inbox.");
  return ctx;
}

export function InboxShell({ children }: { children: ReactNode }) {
  const params = useParams<{ id?: string }>();
  const selectedId = params?.id;
  const { conversations, allCustomers } = useDataset();

  // Abre na fila de revisão, exceto quando a conversa aberta pelo link está fora dela.
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
    const filteredAll = filterConversations(conversations, filters, lookup, { ignoreQueue: true });
    const visible = sortConversations(
      filteredAll.filter((c) => inQueue(c, filters.queue)),
      sort,
    );
    return {
      filters,
      setFilters: (update) => setFiltersState(update),
      sort,
      setSort,
      visible,
      filteredAll,
      selectedId,
    };
  }, [allCustomers, conversations, filters, sort, selectedId]);

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
