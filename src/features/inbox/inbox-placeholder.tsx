"use client";

import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data";
import { inQueue, sortConversations } from "@/lib/demo/selectors";
import { useInbox } from "./inbox-shell";

/** Área da conversa quando nenhuma está selecionada (telas largas). */
export function InboxPlaceholder() {
  const { filteredAll, hrefFor } = useInbox();
  const next = sortConversations(
    filteredAll.filter((c) => inQueue(c, "revisao")),
    "prioridade",
  )[0];
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={MessagesSquare}
        title="Selecione uma conversa"
        description="O agente de IA atende primeiro. Abra uma conversa para acompanhar, revisar ou intervir."
        action={
          next && (
            <Button asChild variant="primary" size="sm">
              <Link href={hrefFor(next.id)}>Abrir a próxima revisão</Link>
            </Button>
          )
        }
      />
    </div>
  );
}
