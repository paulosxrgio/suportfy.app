import { automationActionTypes, automationTriggers } from "@/lib/demo/labels";
import { stores } from "@/lib/demo/data";
import type { Automation } from "@/lib/demo/types";

export const conditionFields: { id: string; label: string }[] = [
  { id: "motivo", label: "Motivo do contato" },
  { id: "estado", label: "Estado da conversa" },
  { id: "canal", label: "Canal" },
  { id: "prioridade", label: "Prioridade" },
  { id: "tag_cliente", label: "Tag do cliente" },
  { id: "mensagem", label: "Texto da mensagem" },
  { id: "pagamento", label: "Pagamento do pedido" },
  { id: "forma_pagamento", label: "Forma de pagamento" },
];

export const conditionOperators = ["é", "não é", "contém"];

/** Frase em linguagem natural que resume a regra. */
export function describeAutomation(a: Pick<Automation, "trigger" | "storeId" | "conditions" | "actions">): string {
  const trigger = automationTriggers.find((t) => t.id === a.trigger)?.label.toLowerCase() ?? "evento";
  const store = a.storeId === "all" ? "em todas as lojas" : `na loja ${stores.find((s) => s.id === a.storeId)?.name ?? ""}`;
  const conditions = a.conditions
    .filter((c) => c.value.trim())
    .map((c) => `${conditionFields.find((f) => f.id === c.field)?.label.toLowerCase() ?? c.field} ${c.operator} “${c.value}”`);
  const acts = a.actions
    .filter((x) => x.type)
    .map((x) => {
      const label = automationActionTypes.find((t) => t.id === x.type)?.label.toLowerCase() ?? x.type;
      return x.value ? `${label} (${x.value})` : label;
    });
  return `Quando: ${trigger} ${store}${conditions.length ? `, se ${conditions.join(" e ")}` : ""}. Então: ${acts.length ? acts.join(", ") : "nenhuma ação definida"}.`;
}
