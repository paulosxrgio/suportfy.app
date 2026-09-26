"use client";

import { useMemo } from "react";
import { inQueue, inView, type InboxView, type ViewContext } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import type { Conversation } from "@/lib/demo/types";

export function useViewContext(): ViewContext {
  const { state } = useDemo();
  const firstName = state.members.find((m) => m.id === CURRENT_USER_ID)?.name.split(" ")[0] ?? "";
  return useMemo(() => ({ currentUserId: CURRENT_USER_ID, currentUserFirstName: firstName }), [firstName]);
}

export interface ViewCounts {
  /** Conversas da visão. */
  total: number;
  /** Com mensagens não lidas. */
  unread: number;
  /** Na fila de revisão humana. */
  review: number;
}

/** Contagens de uma visão, respeitando a loja selecionada. */
export function useViewCounter(): (view: InboxView) => ViewCounts {
  const { conversations } = useDataset();
  const ctx = useViewContext();
  return useMemo(() => {
    const count = (list: Conversation[], view: InboxView): ViewCounts => {
      const inside = list.filter((c) => inView(c, view, ctx));
      return {
        total: inside.length,
        unread: inside.filter((c) => c.unreadCount > 0).length,
        review: inside.filter((c) => inQueue(c, "revisao")).length,
      };
    };
    return (view) => count(conversations, view);
  }, [conversations, ctx]);
}
