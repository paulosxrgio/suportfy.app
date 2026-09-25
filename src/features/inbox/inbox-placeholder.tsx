"use client";

import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data";
import { inQueue, sortConversations } from "@/lib/demo/selectors";
import { useDataset } from "@/lib/demo/store";

/** Área da conversa quando nenhuma está selecionada (telas largas). */
export function InboxPlaceholder() {
  const { conversations } = useDataset();
  const review = sortConversations(
    conversations.filter((c) => inQueue(c, "revisao")),
    "prioridade",
  );
  const withAi = conversations.filter((c) => inQueue(c, "ia")).length;
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={MessagesSquare}
        title="Selecione uma conversa"
        description={
          conversations.length === 0
            ? "Sem conversas por enquanto. Quando os canais estiverem conectados, o agente de IA atende primeiro e as exceções aparecem na fila de revisão."
            : `${review.length === 1 ? "1 conversa aguarda" : `${review.length} conversas aguardam`} revisão humana. ${
                withAi === 1 ? "1 está" : `${withAi} estão`
              } com o agente de IA.`
        }
        action={
          review[0] && (
            <Button asChild variant="primary" size="sm">
              <Link href={`/inbox/${review[0].id}`}>Abrir a próxima revisão</Link>
            </Button>
          )
        }
      />
    </div>
  );
}
