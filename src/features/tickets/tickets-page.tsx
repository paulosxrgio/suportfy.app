"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, MessagesSquare, Plus, SearchX, Ticket } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import {
  AssigneeLabel,
  ChannelIcon,
  ChannelLabel,
  PriorityBadge,
  SlaIndicator,
  StateBadge,
  StoreLabel,
  TagChip,
} from "@/components/shared/domain";
import { FilterBar, FilterMenu, ResultCount, SearchField } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, DefinitionList, EmptyState, ListSkeleton, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { teams } from "@/lib/demo/data";
import { channelLabels, priorityMeta, reasonLabels, ticketStatusMeta } from "@/lib/demo/labels";
import { matchesAssignee, ticketStatus } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, stores, useDataset, useDemo } from "@/lib/demo/store";
import type { Channel, ContactReason, Conversation, Priority, TicketStatus } from "@/lib/demo/types";
import { formatDateTime, formatListTime, matchesQuery } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "numero" | "atualizacao" | "prioridade";

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(column)} className="focus-ring -mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-ink">
        {label}
        <Icon className={cn("size-3", active ? "text-ink-2" : "text-ink-4")} aria-hidden />
      </button>
    </Th>
  );
}

function TicketDetail({ conversation }: { conversation: Conversation }) {
  const { allCustomers } = useDataset();
  const customer = allCustomers.find((c) => c.id === conversation.customerId);
  const status = ticketStatusMeta[ticketStatus(conversation.state)];
  const team = teams.find((t) => t.id === conversation.teamId);
  return (
    <div className="space-y-5 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone} size="md">
          {status.label}
        </Badge>
        <StateBadge state={conversation.state} size="md" />
        <PriorityBadge priority={conversation.priority} />
      </div>
      {conversation.handoff && (
        <Callout tone="warning" title="Motivo do encaminhamento pela IA">
          {conversation.handoff.reason}
          <span className="mt-1 block text-xs text-ink-3">Regra: {conversation.handoff.rule}</span>
        </Callout>
      )}
      {conversation.error && <Callout tone="danger" title="Falha do agente">{conversation.error}</Callout>}
      <div>
        <h3 className="mb-1.5 text-xs font-medium tracking-wide text-ink-3 uppercase">Resumo da IA</h3>
        <p className="text-[13px] leading-relaxed text-ink-2">{conversation.aiSummary}</p>
      </div>
      <DefinitionList
        items={[
          {
            term: "Cliente",
            value: customer ? (
              <Link href={`/clientes/${customer.id}`} className="focus-ring rounded font-medium text-primary-700 hover:underline">
                {customer.name}
              </Link>
            ) : (
              "—"
            ),
          },
          { term: "Loja", value: <StoreLabel storeId={conversation.storeId} /> },
          { term: "Canal", value: <ChannelLabel channel={conversation.channel} /> },
          { term: "Categoria", value: reasonLabels[conversation.reason] },
          { term: "Responsável", value: <AssigneeLabel conversation={conversation} /> },
          { term: "Equipe", value: team?.name ?? "—" },
          { term: "SLA", value: <SlaIndicator conversation={conversation} variant="full" /> },
          { term: "Criado", value: formatDateTime(conversation.createdAt) },
          { term: "Atualizado", value: formatDateTime(conversation.lastActivityAt) },
          {
            term: "Tags",
            value: conversation.tags.length ? (
              <span className="flex flex-wrap gap-1">
                {conversation.tags.map((t) => (
                  <TagChip key={t} name={t} />
                ))}
              </span>
            ) : (
              "—"
            ),
          },
        ]}
      />
    </div>
  );
}

function NewTicketDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (c: Conversation) => void }) {
  const { actions, state } = useDemo();
  const { allCustomers } = useDataset();
  const formId = useId();
  const [customerId, setCustomerId] = useState("");
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState<ContactReason>("status_pedido");
  const [priority, setPriority] = useState<Priority>("normal");
  const [channel, setChannel] = useState<Channel>("email");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const customers = allCustomers.filter((c) => state.store === "all" || c.storeId === state.store);
  const customer = allCustomers.find((c) => c.id === customerId);

  const reset = () => {
    setCustomerId("");
    setSubject("");
    setReason("status_pedido");
    setPriority("normal");
    setChannel("email");
    setDescription("");
    setTouched(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent
        title="Novo ticket"
        description="Registra um atendimento iniciado pela equipe, como uma ligação ou um contato fora dos canais conectados."
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button size="sm" variant="primary" type="submit" form={formId}>
              Criar ticket
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!customer || !subject.trim()) return;
            const created = actions.createTicket({
              customerId: customer.id,
              storeId: customer.storeId,
              channel,
              subject: subject.trim(),
              reason,
              priority,
              description,
            });
            toast.success(`Ticket #${created.ticketNumber} criado`, { description: "Mantido apenas nesta sessão. Nenhuma mensagem foi enviada." });
            reset();
            onOpenChange(false);
            onCreated(created);
          }}
        >
          <Field label="Cliente" className="sm:col-span-2" error={touched && !customer ? "Selecione um cliente." : undefined}>
            {(props) => (
              <Select {...props} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Selecione</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {stores.find((s) => s.id === c.storeId)?.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Assunto" className="sm:col-span-2" error={touched && !subject.trim() ? "Informe o assunto." : undefined}>
            {(props) => <Input {...props} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex.: Cliente ligou sobre troca de tamanho" />}
          </Field>
          <Field label="Categoria">
            {(props) => (
              <Select {...props} value={reason} onChange={(e) => setReason(e.target.value as ContactReason)}>
                {(Object.keys(reasonLabels) as ContactReason[]).map((r) => (
                  <option key={r} value={r}>
                    {reasonLabels[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Prioridade">
            {(props) => (
              <Select {...props} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {(Object.keys(priorityMeta) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {priorityMeta[p].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Canal para responder">
            {(props) => (
              <Select {...props} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                <option value="email">E-mail</option>
                <option value="whatsapp" disabled={Boolean(customer && !customer.phone)}>
                  WhatsApp
                </option>
              </Select>
            )}
          </Field>
          <Field label="Descrição interna" optional className="sm:col-span-2" description="Fica como nota interna no ticket.">
            {(props) => <Textarea {...props} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TicketsPage() {
  const { conversations, allCustomers, members, isEmpty } = useDataset();
  const { state } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedNumber = searchParams.get("ticket");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [reasons, setReasons] = useState<ContactReason[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "atualizacao", dir: "desc" });
  const [newOpen, setNewOpen] = useState(false);

  const customerName = (id: string) => allCustomers.find((c) => c.id === id)?.name ?? "";

  const rows = useMemo(() => {
    const filtered = conversations.filter((c) => {
      if (statuses.length && !statuses.includes(ticketStatus(c.state))) return false;
      if (priorities.length && !priorities.includes(c.priority)) return false;
      if (storeFilter.length && !storeFilter.includes(c.storeId)) return false;
      if (channels.length && !channels.includes(c.channel)) return false;
      if (reasons.length && !reasons.includes(c.reason)) return false;
      if (assignees.length && !assignees.some((a) => matchesAssignee(c, a, CURRENT_USER_ID))) return false;
      const customer = allCustomers.find((cu) => cu.id === c.customerId);
      return matchesQuery(query, `#${c.ticketNumber}`, String(c.ticketNumber), c.subject, customer?.name, customer?.email);
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort.key === "numero") return (a.ticketNumber - b.ticketNumber) * dir;
      if (sort.key === "prioridade") return (priorityMeta[a.priority].rank - priorityMeta[b.priority].rank) * -dir || Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt);
      return (Date.parse(a.lastActivityAt) - Date.parse(b.lastActivityAt)) * dir;
    });
  }, [conversations, statuses, priorities, storeFilter, channels, reasons, assignees, query, sort, allCustomers]);

  const hasFilters = Boolean(query || statuses.length || priorities.length || storeFilter.length || channels.length || reasons.length || assignees.length);
  const clearFilters = () => {
    setQuery("");
    setStatuses([]);
    setPriorities([]);
    setStoreFilter([]);
    setChannels([]);
    setReasons([]);
    setAssignees([]);
  };

  const selected = selectedNumber ? conversations.find((c) => String(c.ticketNumber) === selectedNumber) : undefined;
  const openTicket = (c: Conversation | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (c) params.set("ticket", String(c.ticketNumber));
    else params.delete("ticket");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "numero" ? "desc" : "desc" }));

  const count = (fn: (c: Conversation) => boolean) => conversations.filter(fn).length;

  return (
    <PageContainer>
      <PageHeader
        title="Tickets"
        description="Cada conversa gera um ticket. O status acompanha o estado do atendimento pela IA e pela equipe."
        meta={<DemoBadge />}
        actions={
          <Button size="sm" variant="primary" onClick={() => setNewOpen(true)} disabled={isEmpty}>
            <Plus className="size-3.5" aria-hidden />
            Novo ticket
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField
          label="Buscar tickets"
          placeholder="Buscar por número, assunto ou cliente"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="lg:w-72"
        />
        <FilterBar>
          <FilterMenu
            label="Status"
            selected={statuses}
            onChange={setStatuses}
            options={(Object.keys(ticketStatusMeta) as TicketStatus[]).map((s) => ({
              value: s,
              label: ticketStatusMeta[s].label,
              count: count((c) => ticketStatus(c.state) === s),
            }))}
          />
          <FilterMenu
            label="Prioridade"
            selected={priorities}
            onChange={setPriorities}
            options={(Object.keys(priorityMeta) as Priority[]).map((p) => ({ value: p, label: priorityMeta[p].label, count: count((c) => c.priority === p) }))}
          />
          {state.store === "all" && (
            <FilterMenu
              label="Loja"
              selected={storeFilter}
              onChange={setStoreFilter}
              options={stores.map((s) => ({ value: s.id, label: s.name, count: count((c) => c.storeId === s.id) }))}
            />
          )}
          <FilterMenu
            label="Canal"
            selected={channels}
            onChange={setChannels}
            options={(["whatsapp", "email"] as Channel[]).map((c) => ({ value: c, label: channelLabels[c], count: count((x) => x.channel === c) }))}
          />
          <FilterMenu
            label="Categoria"
            selected={reasons}
            onChange={setReasons}
            options={(Object.keys(reasonLabels) as ContactReason[])
              .map((r) => ({ value: r, label: reasonLabels[r], count: count((c) => c.reason === r) }))
              .filter((o) => o.count > 0)}
          />
          <FilterMenu
            label="Responsável"
            selected={assignees}
            onChange={setAssignees}
            align="end"
            options={[
              { value: "ai", label: "Agente de IA" },
              { value: "me", label: "Eu" },
              { value: "unassigned", label: "Sem responsável" },
              ...members.filter((m) => m.status === "ativo" && m.id !== CURRENT_USER_ID).map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Limpar
            </Button>
          )}
        </FilterBar>
      </div>

      <DataGate skeleton={<TableContainer><ListSkeleton rows={8} /></TableContainer>}>
        {isEmpty ? (
          <TableContainer>
            <EmptyState
              icon={Ticket}
              title="Nenhum ticket ainda"
              description="Tickets são criados automaticamente a partir das conversas de WhatsApp e e-mail. Conecte um canal para começar."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href="/configuracoes/whatsapp">Conectar WhatsApp</Link>
                </Button>
              }
            />
          </TableContainer>
        ) : rows.length === 0 ? (
          <TableContainer>
            <EmptyState
              icon={SearchX}
              title="Nenhum ticket encontrado"
              description="Ajuste a busca ou os filtros para ver mais resultados."
              action={
                <Button size="sm" onClick={clearFilters}>
                  Limpar busca e filtros
                </Button>
              }
            />
          </TableContainer>
        ) : (
          <>
            <TableContainer>
              <Table className="min-w-[980px]">
                <thead>
                  <tr>
                    <SortHeader label="Nº" column="numero" sort={sort} onSort={onSort} className="w-20" />
                    <Th>Assunto</Th>
                    <Th>Cliente</Th>
                    <Th>Loja</Th>
                    <Th>Status</Th>
                    <SortHeader label="Prioridade" column="prioridade" sort={sort} onSort={onSort} />
                    <Th>Responsável</Th>
                    <SortHeader label="Atualização" column="atualizacao" sort={sort} onSort={onSort} className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const status = ticketStatusMeta[ticketStatus(c.state)];
                    return (
                      <Tr key={c.id} interactive selected={selected?.id === c.id} onClick={() => openTicket(c)}>
                        <Td className="font-medium text-ink tabular-nums">#{c.ticketNumber}</Td>
                        <Td className="max-w-[320px]">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTicket(c);
                            }}
                            className="focus-ring block max-w-full truncate rounded text-left font-medium text-ink hover:underline"
                          >
                            {c.subject}
                          </button>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                            <ChannelIcon channel={c.channel} />
                            {reasonLabels[c.reason]}
                          </span>
                        </Td>
                        <Td className="max-w-[180px] truncate">{customerName(c.customerId)}</Td>
                        <Td className="max-w-[170px]">
                          <StoreLabel storeId={c.storeId} />
                        </Td>
                        <Td>
                          <span className="flex flex-col items-start gap-1">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            <span className="text-xs text-ink-3">{c.state === "needs_review" || c.state === "agent_error" ? <StateBadge state={c.state} /> : null}</span>
                          </span>
                        </Td>
                        <Td>
                          <PriorityBadge priority={c.priority} />
                        </Td>
                        <Td className="max-w-[170px]">
                          <AssigneeLabel conversation={c} />
                        </Td>
                        <Td className="text-right whitespace-nowrap text-ink-3 tabular-nums">{formatListTime(c.lastActivityAt)}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableContainer>
            <div className="mt-3">
              <ResultCount count={rows.length} singular="ticket" plural="tickets" />
            </div>
          </>
        )}
      </DataGate>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && openTicket(null)}>
        {selected && (
          <SheetContent
            title={`Ticket #${selected.ticketNumber}`}
            description={selected.subject}
            width="w-[min(100vw,440px)]"
            footer={
              <>
                <Button asChild size="sm" variant="primary">
                  <Link href={`/inbox/${selected.id}`}>
                    <MessagesSquare className="size-3.5" aria-hidden />
                    Abrir conversa na Inbox
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/clientes/${selected.customerId}`}>Ver cliente</Link>
                </Button>
              </>
            }
          >
            <TicketDetail conversation={selected} />
          </SheetContent>
        )}
      </Sheet>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(c) => openTicket(c)} />
    </PageContainer>
  );
}
