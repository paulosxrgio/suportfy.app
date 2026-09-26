"use client";

import { useMemo } from "react";
import type { InboxLookup } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";

/** Dados de quem está usando e nomes de clientes, para busca e recortes da Inbox. */
export function useInboxLookup(): InboxLookup {
  const { state } = useDemo();
  const { allCustomers } = useDataset();
  const firstName = state.members.find((m) => m.id === CURRENT_USER_ID)?.name.split(" ")[0] ?? "";
  return useMemo(
    () => ({
      customerName: (id: string) => allCustomers.find((c) => c.id === id)?.name ?? "",
      currentUserId: CURRENT_USER_ID,
      currentUserFirstName: firstName,
    }),
    [allCustomers, firstName],
  );
}
