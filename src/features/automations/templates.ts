import type { Automation } from "@/lib/demo/types";

export const automationTemplates: (Pick<Automation, "name" | "description" | "trigger" | "conditions" | "actions"> & { id: string })[] = [
  {
    id: "motivo",
    name: "Etiquetar pelo motivo do contato",
    description: "Adiciona uma tag quando a IA classifica o motivo, para organizar filas e relatórios.",
    trigger: "ia_classificou",
    conditions: [{ field: "motivo", operator: "é", value: "Troca" }],
    actions: [{ type: "adicionar_tag", value: "troca" }],
  },
  {
    id: "sla",
    name: "Avisar quando o SLA estiver em risco",
    description: "Notifica o supervisor 30 minutos antes do vencimento do SLA.",
    trigger: "sla_em_risco",
    conditions: [],
    actions: [{ type: "notificar", value: "Supervisor da loja" }],
  },
  {
    id: "revisao",
    name: "Priorizar encaminhamentos da IA",
    description: "Quando a IA encaminhar para revisão, define prioridade alta e atribui à equipe certa.",
    trigger: "ia_encaminhou",
    conditions: [],
    actions: [
      { type: "definir_prioridade", value: "Alta" },
      { type: "atribuir_equipe", value: "Revisão e exceções" },
    ],
  },
];
