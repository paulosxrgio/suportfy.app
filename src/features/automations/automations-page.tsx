"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Ellipsis, FlaskConical, Pause, Pencil, Play, Plus, SearchX, Trash2, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import { StoreLabel } from "@/components/shared/domain";
import { FilterBar, FilterMenu, ResultCount, SearchField } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, ListSkeleton, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from "@/components/ui/menu";
import { automationResultMeta, automationStateMeta, automationTriggers } from "@/lib/demo/labels";
import { useDataset, useDemo } from "@/lib/demo/store";
import type { Automation, AutomationState } from "@/lib/demo/types";
import { formatDateTime, matchesQuery } from "@/lib/format";
import { describeAutomation } from "./describe";
import { automationTemplates } from "./templates";

function TestDialog({ automation, onOpenChange }: { automation: Automation | null; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={Boolean(automation)} onOpenChange={onOpenChange}>
      {automation && (
        <DialogContent
          title={`Testar “${automation.name}”`}
          description="O teste vai avaliar a regra contra conversas passadas, sem executar nenhuma ação."
          footer={
            <>
              <DialogClose asChild>
                <Button size="sm" variant="ghost">
                  Fechar
                </Button>
              </DialogClose>
              <Tooltip content="O motor de automações ainda não foi implementado.">
                <span tabIndex={0} className="focus-ring rounded-md">
                  <Button size="sm" variant="primary" disabled>
                    Executar teste
                  </Button>
                </span>
              </Tooltip>
            </>
          }
        >
          <Callout tone="warning" title="Testes indisponíveis nesta versão">
            Nenhuma automação é executada ou simulada ainda. Quando o motor existir, o teste mostrará quais conversas seriam
            afetadas e quais ações seriam aplicadas.
          </Callout>
          <div className="mt-4 rounded-lg border border-line bg-canvas px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
            {describeAutomation(automation)}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function AutomationsPage() {
  const { automations, isEmpty } = useDataset();
  const { actions } = useDemo();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [states, setStates] = useState<AutomationState[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [testing, setTesting] = useState<Automation | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const rows = useMemo(
    () =>
      automations.filter((a) => {
        if (states.length && !states.includes(a.state)) return false;
        if (triggers.length && !triggers.includes(a.trigger)) return false;
        return matchesQuery(query, a.name, a.description);
      }),
    [automations, states, triggers, query],
  );
  const clear = () => {
    setQuery("");
    setStates([]);
    setTriggers([]);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Automações"
        description="Regras que complementam o agente de IA: etiquetar, priorizar, encaminhar e notificar."
        meta={<DemoBadge />}
        actions={
          <Button asChild size="sm" variant="primary">
            <Link href="/automacoes/nova">
              <Plus className="size-3.5" aria-hidden />
              Nova automação
            </Link>
          </Button>
        }
      />

      <Callout tone="warning" className="mb-4" title="Automações ainda não são executadas">
        As regras podem ser criadas e editadas nesta sessão, mas nenhuma é executada. Execuções e resultados exibidos são
        demonstrativos.
      </Callout>

      {!isEmpty && (
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchField label="Buscar automações" placeholder="Buscar por nome" value={query} onValueChange={setQuery} wrapperClassName="lg:w-72" />
          <FilterBar>
            <FilterMenu
              label="Estado"
              selected={states}
              onChange={setStates}
              options={(Object.keys(automationStateMeta) as AutomationState[]).map((s) => ({
                value: s,
                label: automationStateMeta[s].label,
                count: automations.filter((a) => a.state === s).length,
              }))}
            />
            <FilterMenu
              label="Gatilho"
              selected={triggers}
              onChange={setTriggers}
              options={automationTriggers.map((t) => ({ value: t.id, label: t.label, count: automations.filter((a) => a.trigger === t.id).length }))}
            />
            {(query || states.length > 0 || triggers.length > 0) && (
              <Button size="sm" variant="ghost" onClick={clear}>
                Limpar
              </Button>
            )}
          </FilterBar>
        </div>
      )}

      <DataGate skeleton={<TableContainer><ListSkeleton rows={6} /></TableContainer>}>
        {isEmpty || automations.length === 0 ? (
          <TableContainer>
            <EmptyState
              icon={Workflow}
              title="Nenhuma automação ainda"
              description="Comece por um modelo. Cada regra tem um gatilho, condições opcionais e ações. Ações com consequências, como reembolsos, não estão disponíveis."
            />
            <div className="grid gap-3 border-t border-line p-4 md:grid-cols-3">
              {automationTemplates.map((t) => (
                <Link
                  key={t.id}
                  href={`/automacoes/nova?modelo=${t.id}`}
                  className="focus-ring rounded-lg border border-line p-3 transition-colors hover:border-line-strong hover:bg-canvas"
                >
                  <span className="block text-[13px] font-medium text-ink">{t.name}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-ink-3">{t.description}</span>
                </Link>
              ))}
            </div>
          </TableContainer>
        ) : rows.length === 0 ? (
          <TableContainer>
            <EmptyState icon={SearchX} title="Nenhuma automação encontrada" description="Ajuste a busca ou os filtros." action={<Button size="sm" onClick={clear}>Limpar busca e filtros</Button>} />
          </TableContainer>
        ) : (
          <>
            <TableContainer>
              <Table className="min-w-[960px]">
                <thead>
                  <tr>
                    <Th>Nome</Th>
                    <Th>Gatilho</Th>
                    <Th>Loja</Th>
                    <Th>Estado</Th>
                    <Th>Última execução</Th>
                    <Th>Resultado</Th>
                    <Th className="w-12">
                      <span className="sr-only">Ações</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const trigger = automationTriggers.find((t) => t.id === a.trigger);
                    const st = automationStateMeta[a.state];
                    const result = a.lastRun ? automationResultMeta[a.lastRun.result] : undefined;
                    return (
                      <Tr key={a.id} interactive onClick={() => router.push(`/automacoes/${a.id}`)}>
                        <Td className="max-w-[320px]">
                          <Link
                            href={`/automacoes/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="focus-ring block truncate rounded font-medium text-ink hover:underline"
                          >
                            {a.name}
                          </Link>
                          <span className="block truncate text-xs text-ink-3">{a.description}</span>
                        </Td>
                        <Td className="whitespace-nowrap">{trigger?.label}</Td>
                        <Td className="max-w-[170px]">{a.storeId === "all" ? "Todas as lojas" : <StoreLabel storeId={a.storeId} />}</Td>
                        <Td>
                          <Badge tone={st.tone} dot>
                            {st.label}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-ink-3">{a.lastRun ? formatDateTime(a.lastRun.at) : "Nunca executada"}</Td>
                        <Td>
                          {result && a.lastRun ? (
                            <Tooltip content={a.lastRun.detail}>
                              <span tabIndex={0} className="focus-ring inline-flex rounded" onClick={(e) => e.stopPropagation()}>
                                <Badge tone={result.tone}>{result.label}</Badge>
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="text-ink-4">—</span>
                          )}
                        </Td>
                        <Td onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label={`Ações de ${a.name}`}>
                                <Ellipsis className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/automacoes/${a.id}`}>
                                  <Pencil aria-hidden />
                                  Editar
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  actions.toggleAutomation(a.id);
                                  toast.success(a.state === "ativa" ? "Automação pausada" : "Automação ativada", {
                                    description: "Somente nesta sessão. Nenhuma regra é executada ainda.",
                                  });
                                }}
                              >
                                {a.state === "ativa" ? <Pause aria-hidden /> : <Play aria-hidden />}
                                {a.state === "ativa" ? "Pausar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setTesting(a)}>
                                <FlaskConical aria-hidden />
                                Testar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  actions.saveAutomation(
                                    { ...a, id: actions.newId("au"), name: `${a.name} (cópia)`, state: "rascunho", lastRun: undefined },
                                    true,
                                  );
                                  toast.success("Automação duplicada como rascunho");
                                }}
                              >
                                <Copy aria-hidden />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem danger onSelect={() => setDeleting(a)}>
                                <Trash2 aria-hidden />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableContainer>
            <div className="mt-3">
              <ResultCount count={rows.length} singular="automação" plural="automações" />
            </div>
          </>
        )}
      </DataGate>

      <TestDialog automation={testing} onOpenChange={(open) => !open && setTesting(null)} />
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting && (
          <DialogContent
            size="sm"
            title="Excluir automação?"
            description={`“${deleting.name}” será removida desta sessão de demonstração.`}
            footer={
              <>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    actions.deleteAutomation(deleting.id);
                    toast.success("Automação excluída");
                    setDeleting(null);
                  }}
                >
                  Excluir
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </PageContainer>
  );
}
