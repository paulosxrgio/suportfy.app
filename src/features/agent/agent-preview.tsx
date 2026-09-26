"use client";

import { ArrowRightLeft, BookOpen, Bot, FlaskConical, Package } from "lucide-react";
import { useState } from "react";
import { Segmented } from "@/components/ui/controls";
import { Callout } from "@/components/ui/data";
import type { AgentConfig, AgentLength, AgentTone } from "@/lib/demo/types";

type Scenario = "status" | "reembolso" | "sem_fonte";

const scenarios: Record<Scenario, { label: string; customer: string }> = {
  status: { label: "Status do pedido", customer: "Oi, meu pedido #AU1050 já saiu?" },
  reembolso: { label: "Reembolso", customer: "O produto veio quebrado. Quero o reembolso." },
  sem_fonte: { label: "Sem fonte", customer: "Vocês têm loja física em Curitiba?" },
};

const openings: Record<AgentTone, string> = {
  cordial: "Oi, Gustavo!",
  formal: "Olá, Gustavo.",
  descontraido: "Oi, Gustavo! Tudo certo?",
};

function statusReply(tone: AgentTone, length: AgentLength) {
  const core: Record<AgentTone, string> = {
    cordial: "Seu pedido #AU1050 foi postado em 23/09 e está em trânsito. A previsão da transportadora é entregar até 27/09.",
    formal: "Informamos que o pedido #AU1050 foi postado em 23/09 e encontra-se em trânsito, com previsão de entrega até 27/09.",
    descontraido: "Seu #AU1050 já está a caminho desde 23/09 e a previsão é chegar até 27/09.",
  };
  const extra = " O código de rastreio é TX5539028BR.";
  const detail: Record<AgentTone, string> = {
    cordial: " Se a previsão mudar, te aviso por aqui. Posso ajudar em algo mais?",
    formal: " Caso haja alteração na previsão, enviaremos uma atualização por este canal.",
    descontraido: " Qualquer novidade na entrega eu te conto por aqui!",
  };
  return `${openings[tone]} ${core[tone]}${length !== "curta" ? extra : ""}${length === "detalhada" ? detail[tone] : ""}`;
}

function refundReply(tone: AgentTone, transfers: boolean) {
  const empathy: Record<AgentTone, string> = {
    cordial: "Sinto muito pelo produto danificado.",
    formal: "Lamentamos o ocorrido com o produto.",
    descontraido: "Poxa, que chato o produto ter chegado assim.",
  };
  const action = transfers
    ? "Reembolsos são aprovados pela nossa equipe. Já encaminhei seu caso com os dados do pedido e você recebe o retorno por aqui."
    : "Registrei sua solicitação. Reembolsos passam por validação da equipe antes de qualquer confirmação, e você recebe o retorno por aqui.";
  return `${openings[tone]} ${empathy[tone]} ${action}`;
}

function noSourceReply(tone: AgentTone) {
  const text: Record<AgentTone, string> = {
    cordial: "Não encontrei essa informação nas fontes da loja e não quero te passar algo errado. Encaminhei sua pergunta para a equipe, que responde por aqui.",
    formal: "Não localizamos essa informação nas fontes disponíveis. Para evitar uma resposta imprecisa, sua pergunta foi encaminhada à equipe, que responderá por este canal.",
    descontraido: "Essa eu não achei nas informações da loja, e prefiro não chutar. Já passei sua pergunta para o pessoal da equipe, que te responde por aqui.",
  };
  return `${openings[tone]} ${text[tone]}`;
}

/** Prévia ilustrativa: textos escritos previamente e ajustados pela configuração. Nada é gerado por IA. */
export function AgentPreview({ draft }: { draft: AgentConfig }) {
  const [scenario, setScenario] = useState<Scenario>("status");
  const transfersRefund = draft.handoffCategories.includes("reembolso");
  const signature = draft.signatureByStore.aurora || draft.name;
  const reply =
    scenario === "status" ? statusReply(draft.tone, draft.length) : scenario === "reembolso" ? refundReply(draft.tone, transfersRefund) : noSourceReply(draft.tone);
  const handoff = scenario === "sem_fonte" || scenario === "reembolso";

  return (
    <section className="rounded-2xl border border-line bg-surface" aria-label="Prévia de resposta">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Prévia de resposta</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
          <FlaskConical className="size-3" aria-hidden />
          Exemplo ilustrativo escrito previamente. Não é gerado por IA.
        </p>
      </header>
      <div className="space-y-3 px-4 py-4">
        <Segmented<Scenario>
          label="Cenário da prévia"
          size="xs"
          value={scenario}
          onValueChange={setScenario}
          options={(Object.keys(scenarios) as Scenario[]).map((s) => ({ value: s, label: scenarios[s].label }))}
        />
        <div className="rounded-2xl border border-line bg-canvas p-3">
          <p className="mb-1 text-xs font-medium text-ink-3">Cliente · Aurora Cosméticos · WhatsApp</p>
          <p className="inline-block rounded-2xl rounded-tl-sm border border-line bg-surface px-3 py-2 text-[13px] text-ink">{scenarios[scenario].customer}</p>
          <div className="mt-3 flex flex-col items-end">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-primary-700">
              <Bot className="size-3.5" aria-hidden />
              {draft.name || "Agente"} · {draft.defaultMode === "copilot" ? "rascunho para aprovação" : "resposta automática"}
            </p>
            <p className="max-w-[95%] rounded-2xl rounded-tr-sm border border-primary-200 bg-primary-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line text-ink">
              {reply}
              {"\n\n"}
              <span className="text-ink-2">{signature}</span>
            </p>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-ink-3">
            {scenario === "status" && (
              <li className="flex items-center gap-1.5">
                <Package className="size-3.5" aria-hidden />
                Fonte: pedido #AU1050 (status, rastreio e previsão)
              </li>
            )}
            {scenario === "reembolso" && (
              <li className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" aria-hidden />
                Fonte: Política de trocas e devoluções
              </li>
            )}
            {handoff && (
              <li className="flex items-center gap-1.5">
                <ArrowRightLeft className="size-3.5" aria-hidden />
                {scenario === "sem_fonte"
                  ? "Encaminhada para revisão: nenhuma fonte confiável encontrada"
                  : transfersRefund
                    ? "Encaminhada para revisão: reembolso é categoria transferida"
                    : "Registrada para validação da equipe"}
              </li>
            )}
          </ul>
        </div>
        {scenario === "reembolso" && !transfersRefund && (
          <Callout tone="warning">
            Mesmo sem transferir reembolsos, o agente não executa o reembolso: ações com consequências dependem de ferramentas no
            servidor com validação determinística.
          </Callout>
        )}
        {draft.defaultMode === "off" && (
          <Callout tone="neutral">Com o agente desativado, nenhuma resposta automática seria preparada.</Callout>
        )}
      </div>
    </section>
  );
}
