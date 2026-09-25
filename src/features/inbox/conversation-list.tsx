"use client";

import Link from "next/link";
import { ArrowDownUp, Bot, CircleAlert, Inbox as InboxIcon, ListFilter, Lock, MessageCircle, SearchX, X } from "lucide-react";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import {
  AssigneeLabel,
  ChannelIcon,
  PriorityIcon,
  SlaIndicator,
  StateBadge,
  StoreDot,
  TagChip,
  storeById,
} from "@/components/shared/domain";
import { SearchField } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/controls";
import { EmptyState, ListSkeleton } from "@/components/ui/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@/components/ui/menu";
import { channelLabels, conversationStateMeta, priorityMeta } from "@/lib/demo/labels";
import { emptyInboxFilters, inQueue, type InboxFilters, type InboxQueue, type InboxSort } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, stores, useDataset, useDemo } from "@/lib/demo/store";
import type { Channel, Conversation, ConversationState, Priority } from "@/lib/demo/types";
import { formatListTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useInbox } from "./inbox-shell";

const queues: { id: Exclude<InboxQueue, "todas">; label: string; hint: string }[] = [
  { id: "revisao", label: "Revisão", hint: "Encaminhadas pela IA para uma pessoa ou com erro no agente" },
  { id: "ia", label: "Com a IA", hint: "Conduzidas pelo agente de IA, incluindo as que aguardam o cliente" },
  { id: "equipe", label: "Equipe", hint: "Assumidas por uma pessoa ou com a IA pausada" },
  { id: "resolvidas", label: "Resolvidas", hint: "Resolvidas pela IA ou pela equipe" },
];

const sortLabels: Record<InboxSort, string> = {
  prioridade: "Prioridade de supervisão",
  recentes: "Mais recentes",
  sla: "SLA mais próximo",
};

function QueueSelector() {
  const { filters, setFilters, filteredAll } = useInbox();
  const allActive = filters.queue === "todas";
  return (
    <div className="px-3 pb-3" role="group" aria-label="Filas da Inbox">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-ink-3">Filas de supervisão</p>
        <button
          type="button"
          aria-pressed={allActive}
          onClick={() => setFilters((f) => ({ ...f, queue: "todas" }))}
          className={cn(
            "focus-ring rounded px-1.5 py-0.5 text-xs font-medium",
            allActive ? "bg-primary-50 text-primary-800 ring-1 ring-primary-300" : "text-ink-3 hover:bg-subtle hover:text-ink",
          )}
        >
          Todas · {filteredAll.length}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
      {queues.map((q) => {
        const count = filteredAll.filter((c) => inQueue(c, q.id)).length;
        const active = filters.queue === q.id;
        const attention = q.id === "revisao" && count > 0;
        return (
          <Tooltip key={q.id} content={q.hint}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => setFilters((f) => ({ ...f, queue: q.id }))}
              className={cn(
                "focus-ring flex flex-col items-start rounded-md border px-2 py-1.5 text-left transition-colors",
                active ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500" : "border-line hover:border-line-strong hover:bg-canvas",
              )}
            >
              <span
                className={cn(
                  "text-base leading-5 font-semibold tabular-nums",
                  attention ? "text-warning-700" : active ? "text-primary-800" : "text-ink",
                )}
              >
                {count}
              </span>
              <span className={cn("w-full truncate text-[11.5px]", active ? "text-primary-800" : "text-ink-3")}>{q.label}</span>
            </button>
          </Tooltip>
        );
      })}
      </div>
    </div>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] text-ink hover:bg-subtle">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
    </label>
  );
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? [...list, value] : list.filter((v) => v !== value);
}

function activeFilterCount(f: InboxFilters) {
  return f.states.length + f.channels.length + f.stores.length + f.assignees.length + f.priorities.length + (f.unreadOnly ? 1 : 0);
}

function FiltersPopover() {
  const { filters, setFilters } = useInbox();
  const { state } = useDemo();
  const { members } = useDataset();
  const count = activeFilterCount(filters);
  const set = <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon-sm" variant={count ? "subtle" : "ghost"} aria-label={count ? `Filtros (${count} ativos)` : "Filtros"} className="relative">
          <ListFilter className="size-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-[13px] font-semibold text-ink">Filtros</p>
          <Button
            size="xs"
            variant="ghost"
            disabled={!count}
            onClick={() => setFilters((f) => ({ ...emptyInboxFilters, queue: f.queue, query: f.query }))}
          >
            Limpar filtros
          </Button>
        </div>
        <div className="max-h-[min(70vh,520px)] space-y-4 overflow-y-auto px-3 py-3 scrollbar-thin">
          <label className="flex cursor-pointer items-center justify-between gap-2 px-1 text-[13px] text-ink">
            Somente não lidas
            <Switch checked={filters.unreadOnly} onCheckedChange={(v) => set("unreadOnly", v)} aria-label="Somente não lidas" />
          </label>
          <fieldset>
            <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Estado da conversa</legend>
            {(Object.keys(conversationStateMeta) as ConversationState[]).map((s) => (
              <CheckRow key={s} checked={filters.states.includes(s)} onChange={(v) => set("states", toggle(filters.states, s, v))}>
                <StateBadge state={s} />
              </CheckRow>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Canal</legend>
            {(["whatsapp", "email"] as Channel[]).map((c) => (
              <CheckRow key={c} checked={filters.channels.includes(c)} onChange={(v) => set("channels", toggle(filters.channels, c, v))}>
                <ChannelIcon channel={c} className="text-ink-3" />
                {channelLabels[c]}
              </CheckRow>
            ))}
          </fieldset>
          {state.store === "all" && (
            <fieldset>
              <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Loja</legend>
              {stores.map((s) => (
                <CheckRow key={s.id} checked={filters.stores.includes(s.id)} onChange={(v) => set("stores", toggle(filters.stores, s.id, v))}>
                  <StoreDot storeId={s.id} />
                  {s.name}
                </CheckRow>
              ))}
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Responsável</legend>
            <CheckRow checked={filters.assignees.includes("ai")} onChange={(v) => set("assignees", toggle(filters.assignees, "ai", v))}>
              <Bot className="size-3.5 text-primary-600" aria-hidden />
              Agente de IA
            </CheckRow>
            <CheckRow checked={filters.assignees.includes("me")} onChange={(v) => set("assignees", toggle(filters.assignees, "me", v))}>
              Atribuídas a mim
            </CheckRow>
            <CheckRow
              checked={filters.assignees.includes("unassigned")}
              onChange={(v) => set("assignees", toggle(filters.assignees, "unassigned", v))}
            >
              Sem responsável
            </CheckRow>
            {members
              .filter((m) => m.status === "ativo" && m.id !== CURRENT_USER_ID)
              .map((m) => (
                <CheckRow key={m.id} checked={filters.assignees.includes(m.id)} onChange={(v) => set("assignees", toggle(filters.assignees, m.id, v))}>
                  {m.name}
                </CheckRow>
              ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Prioridade</legend>
            {(Object.keys(priorityMeta) as Priority[]).map((p) => (
              <CheckRow key={p} checked={filters.priorities.includes(p)} onChange={(v) => set("priorities", toggle(filters.priorities, p, v))}>
                {priorityMeta[p].label}
              </CheckRow>
            ))}
          </fieldset>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActiveFilterChips() {
  const { filters, setFilters } = useInbox();
  const { members } = useDataset();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const rm = <K extends "states" | "channels" | "stores" | "assignees" | "priorities">(key: K, value: string) => () =>
    setFilters((f) => ({ ...f, [key]: (f[key] as string[]).filter((v) => v !== value) }));

  if (filters.unreadOnly) chips.push({ key: "unread", label: "Não lidas", remove: () => setFilters((f) => ({ ...f, unreadOnly: false })) });
  filters.states.forEach((s) => chips.push({ key: `s-${s}`, label: conversationStateMeta[s].label, remove: rm("states", s) }));
  filters.channels.forEach((c) => chips.push({ key: `c-${c}`, label: channelLabels[c], remove: rm("channels", c) }));
  filters.stores.forEach((s) => chips.push({ key: `l-${s}`, label: storeById(s)?.name ?? s, remove: rm("stores", s) }));
  filters.assignees.forEach((a) =>
    chips.push({
      key: `a-${a}`,
      label: a === "ai" ? "Agente de IA" : a === "me" ? "Atribuídas a mim" : a === "unassigned" ? "Sem responsável" : (members.find((m) => m.id === a)?.name ?? a),
      remove: rm("assignees", a),
    }),
  );
  filters.priorities.forEach((p) => chips.push({ key: `p-${p}`, label: `Prioridade ${priorityMeta[p].label.toLowerCase()}`, remove: rm("priorities", p) }));

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-6 items-center gap-1 rounded-[5px] bg-primary-50 pr-1 pl-2 text-xs text-primary-800 ring-1 ring-primary-200 ring-inset">
          {c.label}
          <button type="button" onClick={c.remove} className="focus-ring rounded p-0.5 hover:bg-primary-100" aria-label={`Remover filtro ${c.label}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function usePreview(c: Conversation) {
  const { state } = useDemo();
  if (c.state === "agent_error" && c.error) {
    return { icon: CircleAlert, prefix: "Falha: ", text: c.error, className: "text-danger-700" };
  }
  if (c.aiDraft) {
    return { icon: Bot, prefix: "Rascunho da IA: ", text: c.aiDraft.body.replace(/\s+/g, " "), className: "text-ink-2" };
  }
  const last = [...c.timeline].reverse().find((t) => t.type === "message" || t.type === "note");
  if (!last) return { text: "Sem mensagens", className: "text-ink-3" };
  if (last.type === "note") return { icon: Lock, prefix: "Nota: ", text: last.body, className: "text-note-700" };
  if (last.author === "ai") return { icon: Bot, prefix: "IA: ", text: last.body, className: "text-ink-2" };
  if (last.author === "agent") {
    const name = last.authorId === CURRENT_USER_ID ? "Você" : (state.members.find((m) => m.id === last.authorId)?.name.split(" ")[0] ?? "Equipe");
    return { prefix: `${name}: `, text: last.body, className: "text-ink-2" };
  }
  return { text: last.body, className: "text-ink-2" };
}

function ConversationItem({ conversation: c, selected }: { conversation: Conversation; selected: boolean }) {
  const { allCustomers } = useDataset();
  const customer = allCustomers.find((cu) => cu.id === c.customerId);
  const preview = usePreview(c);
  const store = storeById(c.storeId);
  const unread = c.unreadCount > 0;
  const PreviewIcon = preview.icon;

  return (
    <li>
      <Link
        href={`/inbox/${c.id}`}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "focus-ring relative block border-b border-line px-3 py-2.5 transition-colors focus-visible:-outline-offset-2",
          selected ? "bg-primary-50/70" : "hover:bg-canvas",
        )}
      >
        {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary-600" aria-hidden />}
        <div className="flex items-center gap-1.5">
          {unread && <span className="size-2 shrink-0 rounded-full bg-primary-600" aria-label="Não lida" />}
          <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", unread ? "font-semibold text-ink" : "font-medium text-ink")}>
            {customer?.name ?? "Cliente"}
          </span>
          <PriorityIcon priority={c.priority} />
          <span className={cn("shrink-0 text-xs tabular-nums", unread ? "font-medium text-ink-2" : "text-ink-3")}>
            {formatListTime(c.lastActivityAt)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
          <ChannelIcon channel={c.channel} />
          <StoreDot storeId={c.storeId} />
          <span className="min-w-0 truncate">
            {store?.name} · #{c.ticketNumber}
          </span>
          <span className="ml-auto shrink-0">
            <AssigneeLabel conversation={c} showName={false} />
          </span>
        </div>
        <p className={cn("mt-1 flex min-w-0 items-center gap-1 text-[13px]", preview.className)}>
          {PreviewIcon && <PreviewIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />}
          <span className="truncate">
            {preview.prefix && <span className="font-medium">{preview.prefix}</span>}
            {preview.text}
          </span>
        </p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <StateBadge state={c.state} />
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {c.tags.slice(0, 2).map((t) => (
              <TagChip key={t} name={t} />
            ))}
            {c.tags.length > 2 && <span className="text-[11.5px] text-ink-3">+{c.tags.length - 2}</span>}
          </span>
          <SlaIndicator conversation={c} />
        </div>
      </Link>
    </li>
  );
}

export function ConversationList() {
  const { filters, setFilters, sort, setSort, visible, selectedId } = useInbox();
  const { isEmpty } = useDataset();
  const hasFilters = activeFilterCount(filters) > 0 || filters.query.length > 0;

  return (
    <>
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h1 className="text-base font-semibold text-ink">Inbox</h1>
        <DemoBadge label="Demonstração" />
        <div className="ml-auto flex items-center gap-0.5">
          <DropdownMenu>
            <Tooltip content={`Ordenar: ${sortLabels[sort]}`}>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Ordenar lista. Atual: ${sortLabels[sort]}`}>
                  <ArrowDownUp className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as InboxSort)}>
                {(Object.keys(sortLabels) as InboxSort[]).map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {sortLabels[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <FiltersPopover />
        </div>
      </div>
      <div className="px-3 pb-3">
        <SearchField
          label="Buscar conversas"
          placeholder="Buscar cliente, pedido, ticket ou mensagem"
          value={filters.query}
          onValueChange={(query) => setFilters((f) => ({ ...f, query }))}
        />
      </div>
      <QueueSelector />
      <ActiveFilterChips />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line scrollbar-thin">
        <DataGate skeleton={<ListSkeleton rows={7} />}>
          {isEmpty ? (
            <EmptyState
              icon={MessageCircle}
              title="Nenhuma conversa ainda"
              description="As conversas de WhatsApp e e-mail aparecerão aqui quando os canais estiverem conectados. O agente de IA atende primeiro e encaminha exceções para revisão."
              action={
                <>
                  <Button asChild size="sm" variant="primary">
                    <Link href="/configuracoes/whatsapp">Conectar WhatsApp</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/configuracoes/email">Configurar e-mail</Link>
                  </Button>
                </>
              }
            />
          ) : visible.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Nenhuma conversa encontrada"
                description="Nenhuma conversa desta fila corresponde à busca ou aos filtros aplicados."
                action={
                  <Button size="sm" onClick={() => setFilters((f) => ({ ...emptyInboxFilters, queue: f.queue }))}>
                    Limpar busca e filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={InboxIcon}
                title={filters.queue === "revisao" ? "Nada para revisar agora" : "Fila vazia"}
                description={
                  filters.queue === "revisao"
                    ? "Quando o agente de IA encaminhar uma conversa ou falhar ao responder, ela aparecerá aqui."
                    : "Não há conversas nesta fila no momento."
                }
                action={
                  <Button size="sm" onClick={() => setFilters((f) => ({ ...f, queue: "todas" }))}>
                    Ver todas as conversas
                  </Button>
                }
              />
            )
          ) : (
            <ul aria-label="Conversas">
              {visible.map((c) => (
                <ConversationItem key={c.id} conversation={c} selected={c.id === selectedId} />
              ))}
            </ul>
          )}
        </DataGate>
      </div>
    </>
  );
}
