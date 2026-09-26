"use client";

import { useParams } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  emptyInboxFilters,
  filterConversations,
  inQueue,
  inView,
  sortConversations,
  type InboxFilters,
  type InboxSort,
  type InboxView,
} from "@/lib/demo/selectors";
import { useDataset } from "@/lib/demo/store";
import type { Conversation } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { ConversationList } from "./conversation-list";
import { useInboxLookup } from "./use-views";
import { conversationPath, parseInboxPath, viewPath } from "./views";

interface InboxContextValue {
  view: InboxView;
  filters: InboxFilters;
  setFilters: (update: (f: InboxFilters) => InboxFilters) => void;
  sort: InboxSort;
  setSort: (sort: InboxSort) => void;
  visible: Conversation[];
  /** Conversas do canal que passam pelos filtros, ignorando o recorte (para as contagens do seletor). */
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
  const { conversations } = useDataset();
  const lookup = useInboxLookup();

  // Abre em "Para revisar", exceto quando a conversa aberta pelo link está fora desse recorte.
  const [filters, setFiltersState] = useState<InboxFilters>(() => {
    const selected = conversations.find((c) => c.id === selectedId);
    const hasReview = conversations.some((c) => inQueue(c, "revisao"));
    const status = hasReview && (!selected || inQueue(selected, "revisao")) ? "revisao" : "abertas";
    return { ...emptyInboxFilters, status };
  });
  const [sort, setSort] = useState<InboxSort>("prioridade");

  const value = useMemo<InboxContextValue>(() => {
    const inside = conversations.filter((c) => inView(c, view));
    const filteredAll = filterConversations(inside, filters, lookup, { ignoreStatus: true });
    const visible = sortConversations(filterConversations(filteredAll, filters, lookup), sort);
    return {
      view,
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
  }, [conversations, filters, lookup, sort, selectedId, view]);

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
