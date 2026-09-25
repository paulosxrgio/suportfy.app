"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { NotFoundContent } from "@/components/shared/not-found-content";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Panel } from "@/components/ui/data";
import { Field, Input, Select } from "@/components/ui/field";
import { automationActionTypes, automationStateMeta, automationTriggers } from "@/lib/demo/labels";
import { stores, useDataset, useDemo } from "@/lib/demo/store";
import type { Automation, AutomationAction, AutomationCondition, AutomationState } from "@/lib/demo/types";
import { conditionFields, conditionOperators, describeAutomation } from "./describe";
import { automationTemplates } from "./templates";

type Draft = Pick<Automation, "name" | "description" | "trigger" | "storeId" | "conditions" | "actions">;

const blankDraft: Draft = {
  name: "",
  description: "",
  trigger: "ia_classificou",
  storeId: "all",
  conditions: [{ field: "motivo", operator: "é", value: "" }],
  actions: [{ type: "adicionar_tag", value: "" }],
};

export function AutomationBuilder({ id }: { id?: string }) {
  const { actions } = useDemo();
  const { automations } = useDataset();
  const router = useRouter();
  const searchParams = useSearchParams();
  const existing = id ? automations.find((a) => a.id === id) : undefined;
  const template = automationTemplates.find((t) => t.id === searchParams.get("modelo"));
  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) return existing;
    if (template) return { ...blankDraft, ...template, storeId: "all" };
    return blankDraft;
  });
  const [touched, setTouched] = useState(false);

  if (id && !existing) {
    return (
      <NotFoundContent title="Automação não encontrada" description="Ela pode ter sido excluída nesta sessão." href="/automacoes" cta="Voltar para automações" />
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setCondition = (i: number, patch: Partial<AutomationCondition>) =>
    set("conditions", draft.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setAction = (i: number, patch: Partial<AutomationAction>) => set("actions", draft.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const trigger = automationTriggers.find((t) => t.id === draft.trigger);
  const validActions = draft.actions.filter((a) => a.type && !automationActionTypes.find((t) => t.id === a.type)?.consequential);

  const save = (state: AutomationState) => {
    setTouched(true);
    if (!draft.name.trim() || validActions.length === 0) {
      toast.error("Revise a automação", { description: "Informe um nome e pelo menos uma ação." });
      return;
    }
    const automation: Automation = {
      ...(existing ?? { lastRun: undefined }),
      ...draft,
      name: draft.name.trim(),
      conditions: draft.conditions.filter((c) => c.value.trim()),
      actions: validActions,
      id: existing?.id ?? actions.newId("au"),
      state,
    };
    actions.saveAutomation(automation, !existing);
    toast.success(state === "ativa" ? "Automação salva e ativada" : "Automação salva como rascunho", {
      description: "Somente nesta sessão. Nenhuma automação é executada ainda.",
    });
    router.push("/automacoes");
  };

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Automações", href: "/automacoes" }, { label: existing ? existing.name : "Nova automação" }]}
        title={existing ? "Editar automação" : "Nova automação"}
        meta={existing && <Badge tone={automationStateMeta[existing.state].tone}>{automationStateMeta[existing.state].label}</Badge>}
        description="Defina quando a regra roda, em quais condições e o que ela faz."
      />

      <Callout tone="warning" className="mb-4">
        Esta tela monta a regra, mas nenhuma automação é executada nesta versão.
      </Callout>

      <div className="space-y-4">
        <Panel title="Identificação">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome" className="md:col-span-2" error={touched && !draft.name.trim() ? "Informe um nome." : undefined}>
              {(props) => <Input {...props} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Priorizar clientes VIP" />}
            </Field>
            <Field label="Descrição" optional className="md:col-span-2">
              {(props) => <Input {...props} value={draft.description} onChange={(e) => set("description", e.target.value)} />}
            </Field>
            <Field label="Loja">
              {(props) => (
                <Select {...props} value={draft.storeId} onChange={(e) => set("storeId", e.target.value)}>
                  <option value="all">Todas as lojas</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Panel>

        <Panel title="1. Quando" description="O evento que dispara a regra.">
          <Field label="Gatilho" description={trigger?.description}>
            {(props) => (
              <Select {...props} value={draft.trigger} onChange={(e) => set("trigger", e.target.value)}>
                {automationTriggers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Panel>

        <Panel title="2. Se" description="Todas as condições precisam ser verdadeiras. Deixe vazio para rodar sempre.">
          <div className="space-y-2">
            {draft.conditions.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
                <Select value={c.field} onChange={(e) => setCondition(i, { field: e.target.value })} aria-label={`Campo da condição ${i + 1}`}>
                  {conditionFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select value={c.operator} onChange={(e) => setCondition(i, { operator: e.target.value })} aria-label={`Operador da condição ${i + 1}`}>
                  {conditionOperators.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
                <Input value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} placeholder="Valor" aria-label={`Valor da condição ${i + 1}`} />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => set("conditions", draft.conditions.filter((_, idx) => idx !== i))}
                  aria-label={`Remover condição ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => set("conditions", [...draft.conditions, { field: "motivo", operator: "é", value: "" }])}>
              <Plus className="size-3.5" aria-hidden />
              Adicionar condição
            </Button>
          </div>
        </Panel>

        <Panel title="3. Então" description="O que a regra faz. Ações com consequências não estão disponíveis.">
          <div className="space-y-2">
            {draft.actions.map((a, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Select value={a.type} onChange={(e) => setAction(i, { type: e.target.value })} aria-label={`Tipo da ação ${i + 1}`}>
                  {automationActionTypes.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.consequential}>
                      {t.label}
                      {t.consequential ? " — sujeita a regras e validação (indisponível)" : ""}
                    </option>
                  ))}
                </Select>
                <Input value={a.value} onChange={(e) => setAction(i, { value: e.target.value })} placeholder="Valor (tag, equipe, template…)" aria-label={`Valor da ação ${i + 1}`} />
                <Button size="icon" variant="ghost" onClick={() => set("actions", draft.actions.filter((_, idx) => idx !== i))} aria-label={`Remover ação ${i + 1}`}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {touched && validActions.length === 0 && <p className="text-xs text-danger-700">Adicione pelo menos uma ação.</p>}
            <Button size="sm" variant="ghost" onClick={() => set("actions", [...draft.actions, { type: "adicionar_tag", value: "" }])}>
              <Plus className="size-3.5" aria-hidden />
              Adicionar ação
            </Button>
          </div>
        </Panel>

        <Panel title="Resumo">
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
            <Zap className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
            {describeAutomation(draft)}
          </p>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          <Button asChild size="sm" variant="ghost">
            <Link href="/automacoes">Cancelar</Link>
          </Button>
          <Button size="sm" onClick={() => save("rascunho")}>
            Salvar como rascunho
          </Button>
          <Button size="sm" variant="primary" onClick={() => save("ativa")}>
            Salvar e ativar
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
