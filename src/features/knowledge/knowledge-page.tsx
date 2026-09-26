"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, BookOpen, Bot, FilePlus2, FileText, Link2, Pencil, Plus, SearchX, Send, Undo2, Upload } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import { StoreDot } from "@/components/shared/domain";
import { FilterBar, FilterMenu, ResultCount, SearchField } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, DefinitionList, EmptyState, ListSkeleton, Panel } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { knowledgeStatusMeta, knowledgeTypeLabels } from "@/lib/demo/labels";
import { CURRENT_USER_ID, stores, useDataset, useDemo } from "@/lib/demo/store";
import type { KnowledgeItem, KnowledgeStatus, KnowledgeType } from "@/lib/demo/types";
import { demoNowIso, formatDateShort, formatDateTime, matchesQuery } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

function storeScope(item: KnowledgeItem) {
  if (item.storeIds === "all") return "Todas as lojas";
  return item.storeIds.map((id) => stores.find((s) => s.id === id)?.name).join(", ");
}

function AvailabilityBadge({ item }: { item: KnowledgeItem }) {
  return item.status === "publicado" ? (
    <Badge tone="primary" icon={<Bot aria-hidden />}>
      Disponível para o agente
    </Badge>
  ) : (
    <Badge tone="neutral">Indisponível para o agente</Badge>
  );
}

function EditorDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: KnowledgeItem;
}) {
  const { actions } = useDemo();
  const formId = useId();
  const [type, setType] = useState<KnowledgeType>(item?.type ?? "faq");
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [scope, setScope] = useState<string>(item ? (item.storeIds === "all" ? "all" : item.storeIds[0]) : "all");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const isNew = !item;

  const submit = () => {
    setTouched(true);
    if (!title.trim() || !content.trim()) return;
    const now = demoNowIso();
    if (isNew) {
      const created: KnowledgeItem = {
        id: actions.newId("kb"),
        title: title.trim(),
        type,
        status: "rascunho",
        storeIds: scope === "all" ? "all" : [scope],
        source: { kind: "manual", label: "Escrito pela equipe" },
        version: 1,
        versions: [{ version: 1, at: now, authorId: CURRENT_USER_ID, note: "Primeira versão." }],
        updatedAt: now,
        updatedBy: CURRENT_USER_ID,
        content: content.trim(),
      };
      actions.saveKnowledge(created, true);
      toast.success("Rascunho criado", { description: "Publique quando estiver pronto para o agente usar. Mantido só nesta sessão." });
    } else {
      const version = item.version + 1;
      actions.saveKnowledge(
        {
          ...item,
          title: title.trim(),
          type,
          content: content.trim(),
          storeIds: scope === "all" ? "all" : [scope],
          version,
          versions: [{ version, at: now, authorId: CURRENT_USER_ID, note: note.trim() || "Edição do conteúdo." }, ...item.versions],
          updatedAt: now,
          updatedBy: CURRENT_USER_ID,
        },
        false,
      );
      toast.success(`Versão ${version} salva`, { description: "Mantida apenas nesta sessão." });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={isNew ? "Adicionar conteúdo" : `Editar “${item.title}”`}
        description={isNew ? "Novos conteúdos começam como rascunho e não ficam disponíveis para o agente até serem publicados." : "Salvar cria uma nova versão e mantém o histórico."}
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button size="sm" variant="primary" type="submit" form={formId}>
              {isNew ? "Criar rascunho" : "Salvar nova versão"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {isNew && (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink">Origem</legend>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="flex items-start gap-2 rounded-lg border border-primary-500 bg-primary-50/60 p-3 ring-1 ring-primary-500">
                  <FilePlus2 className="mt-0.5 size-4 text-primary-700" aria-hidden />
                  <span>
                    <span className="block text-[13px] font-medium text-ink">Escrever</span>
                    <span className="block text-xs text-ink-3">FAQ, política ou documento</span>
                  </span>
                </div>
                {[
                  { icon: Upload, title: "Enviar arquivo", hint: "PDF ou DOCX" },
                  { icon: Link2, title: "Importar de URL", hint: "Página da loja" },
                ].map(({ icon: Icon, title: t, hint }) => (
                  <div key={t} className="flex items-start gap-2 rounded-lg border border-line bg-canvas p-3 opacity-70" aria-disabled>
                    <Icon className="mt-0.5 size-4 text-ink-4" aria-hidden />
                    <span>
                      <span className="block text-[13px] font-medium text-ink-3">{t}</span>
                      <span className="block text-xs text-ink-3">{hint} · indisponível nesta etapa</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">O processamento de arquivos e páginas ainda não foi implementado.</p>
            </fieldset>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo">
              {(props) => (
                <Select {...props} value={type} onChange={(e) => setType(e.target.value as KnowledgeType)}>
                  {(Object.keys(knowledgeTypeLabels) as KnowledgeType[]).map((t) => (
                    <option key={t} value={t}>
                      {knowledgeTypeLabels[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Lojas">
              {(props) => (
                <Select {...props} value={scope} onChange={(e) => setScope(e.target.value)}>
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
          <Field label="Título" error={touched && !title.trim() ? "Informe um título." : undefined}>
            {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Prazo para troca de produtos" />}
          </Field>
          <Field
            label="Conteúdo"
            error={touched && !content.trim() ? "Escreva o conteúdo." : undefined}
            description="Escreva como um guia para o agente: fatos, prazos e exceções. Evite informações que mudam com frequência."
          >
            {(props) => <Textarea {...props} value={content} onChange={(e) => setContent(e.target.value)} rows={8} />}
          </Field>
          {!isNew && (
            <Field label="O que mudou" optional>
              {(props) => <Input {...props} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Atualiza prazo de troca" />}
            </Field>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KnowledgeDetail({ item, onEdit }: { item: KnowledgeItem; onEdit: () => void }) {
  const { state, actions } = useDemo();
  const status = knowledgeStatusMeta[item.status];
  const author = (id: string) => (id === CURRENT_USER_ID ? "Você" : (state.members.find((m) => m.id === id)?.name ?? "Equipe"));
  const citations = state.conversations.filter((c) =>
    c.timeline.some((t) => t.type === "message" && t.sources?.some((s) => s.refId === item.id)),
  ).length;

  const changeStatus = (next: KnowledgeStatus, message: string) => {
    actions.setKnowledgeStatus(item.id, next);
    toast.success(message, { description: "Alteração mantida apenas nesta sessão." });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} size="md">
            {status.label}
          </Badge>
          <AvailabilityBadge item={item} />
        </div>
        <h2 className="mt-2 text-lg font-semibold text-ink">{item.title}</h2>
      </div>
      {item.status !== "publicado" && (
        <Callout tone="warning">
          {item.status === "rascunho"
            ? "Este conteúdo está em rascunho e não está disponível para o agente. Publique para que ele possa ser consultado."
            : "Conteúdo arquivado: mantido apenas para consulta da equipe e indisponível para o agente."}
        </Callout>
      )}
      <div className="flex flex-wrap gap-2">
        {item.status !== "publicado" && (
          <Button size="sm" variant="primary" onClick={() => changeStatus("publicado", "Conteúdo publicado")}>
            <Send className="size-3.5" aria-hidden />
            Publicar
          </Button>
        )}
        <Button size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </Button>
        {item.status === "publicado" && (
          <Button size="sm" variant="ghost" onClick={() => changeStatus("rascunho", "Conteúdo voltou para rascunho")}>
            <Undo2 className="size-3.5" aria-hidden />
            Voltar para rascunho
          </Button>
        )}
        {item.status !== "arquivado" && (
          <Button size="sm" variant="ghost" onClick={() => changeStatus("arquivado", "Conteúdo arquivado")}>
            <Archive className="size-3.5" aria-hidden />
            Arquivar
          </Button>
        )}
      </div>
      <DefinitionList
        items={[
          { term: "Tipo", value: knowledgeTypeLabels[item.type] },
          { term: "Lojas", value: storeScope(item) },
          { term: "Fonte", value: item.source.label },
          { term: "Versão", value: `Versão ${item.version}` },
          { term: "Atualizado", value: `${formatDateTime(item.updatedAt)} por ${author(item.updatedBy)}` },
          { term: "Uso", value: citations ? `Citado em ${citations} ${citations === 1 ? "conversa" : "conversas"} (demonstração)` : "Nenhuma citação" },
        ]}
      />
      <section>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">Conteúdo</h3>
        <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-line text-ink">
          {item.content}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">Histórico de versões</h3>
        <ol className="space-y-2">
          {item.versions.map((v) => (
            <li key={v.version} className="flex items-start gap-3 text-[13px]">
              <span className="mt-0.5 rounded bg-subtle px-1.5 text-xs font-medium text-ink-2 tabular-nums">v{v.version}</span>
              <span className="min-w-0">
                <span className="block text-ink-2">{v.note}</span>
                <span className="block text-xs text-ink-3">
                  {author(v.authorId)} · {formatDateShort(v.at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function KnowledgePage() {
  const { knowledge, isEmpty } = useDataset();
  const { state } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedParam = searchParams.get("item");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<KnowledgeStatus[]>([]);
  const [types, setTypes] = useState<KnowledgeType[]>([]);
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [editor, setEditor] = useState<{ open: boolean; item?: KnowledgeItem; key: number }>({ open: false, key: 0 });
  const [sheetOpen, setSheetOpen] = useState(Boolean(selectedParam));
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const rows = useMemo(
    () =>
      knowledge
        .filter((k) => {
          if (statuses.length && !statuses.includes(k.status)) return false;
          if (types.length && !types.includes(k.type)) return false;
          if (storeFilter.length && !(k.storeIds === "all" || k.storeIds.some((s) => storeFilter.includes(s)))) return false;
          return matchesQuery(query, k.title, k.content);
        })
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [knowledge, statuses, types, storeFilter, query],
  );

  const selected = knowledge.find((k) => k.id === selectedParam) ?? rows[0];
  const select = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("item", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setSheetOpen(true);
  };
  const openEditor = (item?: KnowledgeItem) => setEditor((e) => ({ open: true, item, key: e.key + 1 }));
  const hasFilters = Boolean(query || statuses.length || types.length || storeFilter.length);
  const clear = () => {
    setQuery("");
    setStatuses([]);
    setTypes([]);
    setStoreFilter([]);
  };
  const published = knowledge.filter((k) => k.status === "publicado").length;

  return (
    <PageContainer>
      <PageHeader
        title="Conhecimento"
        description="Políticas, FAQs e documentos que o agente consulta para responder. Apenas o que está publicado fica disponível para ele."
        meta={<DemoBadge />}
        actions={
          <Button size="sm" variant="primary" onClick={() => openEditor()} disabled={isEmpty}>
            <Plus className="size-3.5" aria-hidden />
            Adicionar conteúdo
          </Button>
        }
      />

      {!isEmpty && (
        <Callout tone="info" icon={Bot} className="mb-4">
          {published} de {knowledge.length} conteúdos estão publicados e disponíveis para o agente. Rascunhos e arquivados nunca são
          consultados. Nesta etapa, nenhum arquivo é processado.
        </Callout>
      )}

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField label="Buscar conteúdo" placeholder="Buscar por título ou texto" value={query} onValueChange={setQuery} wrapperClassName="lg:w-72" />
        <FilterBar>
          <FilterMenu
            label="Status"
            selected={statuses}
            onChange={setStatuses}
            options={(Object.keys(knowledgeStatusMeta) as KnowledgeStatus[]).map((s) => ({
              value: s,
              label: knowledgeStatusMeta[s].label,
              count: knowledge.filter((k) => k.status === s).length,
            }))}
          />
          <FilterMenu
            label="Tipo"
            selected={types}
            onChange={setTypes}
            options={(Object.keys(knowledgeTypeLabels) as KnowledgeType[]).map((t) => ({
              value: t,
              label: knowledgeTypeLabels[t],
              count: knowledge.filter((k) => k.type === t).length,
            }))}
          />
          {state.store === "all" && (
            <FilterMenu label="Loja" selected={storeFilter} onChange={setStoreFilter} options={stores.map((s) => ({ value: s.id, label: s.name }))} />
          )}
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Limpar
            </Button>
          )}
        </FilterBar>
      </div>

      <DataGate skeleton={<Panel bodyClassName="p-0"><ListSkeleton rows={7} /></Panel>}>
        {isEmpty ? (
          <Panel>
            <EmptyState
              icon={BookOpen}
              title="Nenhum conteúdo ainda"
              description="Comece pelas políticas de troca, prazos de entrega e formas de pagamento: são as perguntas mais comuns. Volte aos dados de demonstração para testar a criação."
            />
          </Panel>
        ) : rows.length === 0 ? (
          <Panel>
            <EmptyState icon={SearchX} title="Nenhum conteúdo encontrado" description="Ajuste a busca ou os filtros." action={<Button size="sm" onClick={clear}>Limpar busca e filtros</Button>} />
          </Panel>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
            <div>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface" aria-label="Conteúdos">
                {rows.map((k) => {
                  const meta = knowledgeStatusMeta[k.status];
                  const active = selected?.id === k.id;
                  return (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={() => select(k.id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "focus-ring relative block w-full px-4 py-3 text-left transition-colors focus-visible:-outline-offset-2",
                          active ? "bg-primary-50/70" : "hover:bg-canvas",
                        )}
                      >
                        {active && <span className="absolute inset-y-0 left-0 hidden w-0.5 bg-primary-600 lg:block" aria-hidden />}
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText className="size-4 shrink-0 text-ink-4" aria-hidden />
                            <span className="truncate text-[13.5px] font-medium text-ink">{k.title}</span>
                          </span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-xs text-ink-3">
                          <span>{knowledgeTypeLabels[k.type]}</span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            {k.storeIds !== "all" && k.storeIds.length === 1 && <StoreDot storeId={k.storeIds[0]} />}
                            {storeScope(k)}
                          </span>
                          <span aria-hidden>·</span>
                          <span>v{k.version}</span>
                          <span aria-hidden>·</span>
                          <span>{formatDateShort(k.updatedAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3">
                <ResultCount count={rows.length} singular="conteúdo" plural="conteúdos" />
              </div>
            </div>
            <div className="hidden lg:block">
              {selected && (
                <Panel className="sticky top-4">
                  <KnowledgeDetail item={selected} onEdit={() => openEditor(selected)} />
                </Panel>
              )}
            </div>
          </div>
        )}
      </DataGate>

      <Sheet open={!isDesktop && sheetOpen && Boolean(selectedParam) && Boolean(selected)} onOpenChange={setSheetOpen}>
        {selected && (
          <SheetContent title="Conteúdo" width="w-[min(100vw,480px)]">
            <div className="px-4 py-4">
              <KnowledgeDetail item={selected} onEdit={() => openEditor(selected)} />
            </div>
          </SheetContent>
        )}
      </Sheet>

      <EditorDialog key={editor.key} open={editor.open} item={editor.item} onOpenChange={(open) => setEditor((e) => ({ ...e, open }))} />
    </PageContainer>
  );
}
