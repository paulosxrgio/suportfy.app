"use client";

import Link from "next/link";
import {
  ArrowDownUp,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Ellipsis,
  Inbox as InboxIcon,
  ListFilter,
  Lock,
  MessageCircle,
  SearchX,
  Ticket,
  X,
} from "lucide-react";
import { DataGate } from "@/components/shared/demo";
import { ChannelIcon, PriorityIcon, SlaIndicator, StateBadge, StoreDot, storeById } from "@/components/shared/domain";
import { SearchField } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Avatar, EmptyState, ListSkeleton } from "@/components/ui/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@/components/ui/menu";
import { channelLabels, priorityMeta } from "@/lib/demo/labels";
import { emptyInboxFilters, inStatus, slaInfo, type InboxFilters, type InboxSort, type InboxStatus } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, stores, useDataset, useDemo } from "@/lib/demo/store";
import type { Channel, Conversation, Priority } from "@/lib/demo/types";
import { formatListTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useInbox } from "./inbox-shell";
import { useInboxLookup } from "./use-views";
import { statusGroups, statusLabels, viewTitle } from "./views";

const sortLabels: Record<InboxSort, string> = {
  prioridade: "Prioridade de supervisão",
  recentes: "Mais recentes",
  sla: "SLA mais próximo",
};

/** Um único seletor para o recorte da lista, no lugar de abas e pastas no menu. */
function StatusSelector() {
  const { filters, setFilters, filteredAll } = useInbox();
  const lookup = useInboxLookup();
  const count = (status: InboxStatus) => filteredAll.filter((c) => inStatus(c, status, lookup)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-ring -ml-1 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] font-medium text-ink-2 hover:bg-subtle hover:text-ink data-[state=open]:bg-subtle"
          aria-label={`Recorte da lista: ${statusLabels[filters.status]}. Alterar`}
        >
          {statusLabels[filters.status]}
          <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {statusGroups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
            {group.items.map((item) => {
              const active = filters.status === item.id;
              return (
                <DropdownMenuItem key={item.id} onSelect={() => setFilters((f) => ({ ...f, status: item.id }))} title={item.hint}>
                  <Check className={cn(!active && "invisible")} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-ink-4 tabular-nums">{count(item.id)}</span>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
  return f.channels.length + f.stores.length + f.assignees.length + f.priorities.length + f.tags.length;
}

function FiltersPopover() {
  const { filters, setFilters, view } = useInbox();
  const { state } = useDemo();
  const { members, conversations } = useDataset();
  const count = activeFilterCount(filters);
  const set = <K extends keyof InboxFilters>(key: K, value: InboxFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const tagOptions = [...new Set([...conversations.flatMap((c) => c.tags), ...filters.tags])].sort();

  return (
    <Popover>
      <Tooltip content="Filtros">
        <PopoverTrigger asChild>
          <Button size="icon-sm" variant={count ? "subtle" : "ghost"} aria-label={count ? `Filtros (${count} ativos)` : "Filtros"} className="relative">
            <ListFilter className="size-4" />
            {count > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary-600" aria-hidden />}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-[280px]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-[13px] font-semibold text-ink">Filtros</p>
          <Button
            size="xs"
            variant="ghost"
            disabled={!count}
            onClick={() => setFilters((f) => ({ ...emptyInboxFilters, status: f.status, query: f.query }))}
          >
            Limpar
          </Button>
        </div>
        <div className="max-h-[min(70vh,520px)] space-y-4 overflow-y-auto px-3 py-3 scrollbar-thin">
          <fieldset>
            <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Prioridade</legend>
            {(Object.keys(priorityMeta) as Priority[]).map((p) => (
              <CheckRow key={p} checked={filters.priorities.includes(p)} onChange={(v) => set("priorities", toggle(filters.priorities, p, v))}>
                {priorityMeta[p].label}
              </CheckRow>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Responsável</legend>
            <CheckRow checked={filters.assignees.includes("ai")} onChange={(v) => set("assignees", toggle(filters.assignees, "ai", v))}>
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
          {tagOptions.length > 0 && (
            <fieldset>
              <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Tags</legend>
              {tagOptions.map((t) => (
                <CheckRow key={t} checked={filters.tags.includes(t)} onChange={(v) => set("tags", toggle(filters.tags, t, v))}>
                  {t}
                </CheckRow>
              ))}
            </fieldset>
          )}
          {view.kind !== "canal" && (
            <fieldset>
              <legend className="mb-1 px-1 text-xs font-medium text-ink-3">Canal</legend>
              {(["whatsapp", "email"] as Channel[]).map((c) => (
                <CheckRow key={c} checked={filters.channels.includes(c)} onChange={(v) => set("channels", toggle(filters.channels, c, v))}>
                  <ChannelIcon channel={c} className="text-ink-3" />
                  {channelLabels[c]}
                </CheckRow>
              ))}
            </fieldset>
          )}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActiveFilterChips() {
  const { filters, setFilters } = useInbox();
  const { members } = useDataset();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const rm = <K extends "channels" | "stores" | "assignees" | "priorities" | "tags">(key: K, value: string) => () =>
    setFilters((f) => ({ ...f, [key]: (f[key] as string[]).filter((v) => v !== value) }));

  filters.priorities.forEach((p) => chips.push({ key: `p-${p}`, label: `Prioridade ${priorityMeta[p].label.toLowerCase()}`, remove: rm("priorities", p) }));
  filters.assignees.forEach((a) =>
    chips.push({
      key: `a-${a}`,
      label: a === "ai" ? "Agente de IA" : a === "me" ? "Atribuídas a mim" : a === "unassigned" ? "Sem responsável" : (members.find((m) => m.id === a)?.name ?? a),
      remove: rm("assignees", a),
    }),
  );
  filters.tags.forEach((t) => chips.push({ key: `t-${t}`, label: `Tag ${t}`, remove: rm("tags", t) }));
  filters.channels.forEach((c) => chips.push({ key: `c-${c}`, label: channelLabels[c], remove: rm("channels", c) }));
  filters.stores.forEach((s) => chips.push({ key: `l-${s}`, label: storeById(s)?.name ?? s, remove: rm("stores", s) }));

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-6 items-center gap-1 rounded-md bg-subtle pr-1 pl-2 text-xs text-ink-2">
          {c.label}
          <button type="button" onClick={c.remove} className="focus-ring rounded p-0.5 hover:bg-muted" aria-label={`Remover filtro ${c.label}`}>
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
    return { icon: Bot, prefix: "Rascunho da IA: ", text: c.aiDraft.body.replace(/\s+/g, " "), className: "text-ink-3" };
  }
  const last = [...c.timeline].reverse().find((t) => t.type === "message" || t.type === "note");
  if (!last) return { text: "Sem mensagens", className: "text-ink-3" };
  if (last.type === "note") return { icon: Lock, prefix: "Nota: ", text: last.body, className: "text-ink-3" };
  if (last.author === "ai") return { icon: Bot, prefix: "IA: ", text: last.body, className: "text-ink-3" };
  if (last.author === "agent") {
    const name = last.authorId === CURRENT_USER_ID ? "Você" : (state.members.find((m) => m.id === last.authorId)?.name.split(" ")[0] ?? "Equipe");
    return { prefix: `${name}: `, text: last.body, className: "text-ink-3" };
  }
  return { text: last.body, className: "text-ink-3" };
}

function ConversationItem({ conversation: c, selected }: { conversation: Conversation; selected: boolean }) {
  const { view, hrefFor } = useInbox();
  const { allCustomers } = useDataset();
  const customer = allCustomers.find((cu) => cu.id === c.customerId);
  const preview = usePreview(c);
  const store = storeById(c.storeId);
  const unread = c.unreadCount > 0;
  const PreviewIcon = preview.icon;
  const sla = slaInfo(c);
  // Casos que pedem uma pessoa sempre mostram o selo; o atendimento da IA fica discreto.
  const showState = c.state === "agent_error" || c.state === "needs_review" || c.state === "agent_paused";
  const showSla = sla.status === "risco" || sla.status === "vencido";
  const crossChannel = view.kind !== "canal";

  return (
    <li>
      <Link
        href={hrefFor(c.id)}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "focus-ring relative flex gap-3 px-3 py-3 transition-colors focus-visible:-outline-offset-2",
          selected ? "bg-primary-50/70" : "hover:bg-canvas",
        )}
      >
        {selected && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary-600" aria-hidden />}
        <Avatar name={customer?.name ?? "Cliente"} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate text-[13.5px] text-ink", unread ? "font-semibold" : "font-medium")}>
              {customer?.name ?? "Cliente"}
            </span>
            <PriorityIcon priority={c.priority} />
            <span className={cn("shrink-0 text-xs tabular-nums", unread ? "font-medium text-primary-700" : "text-ink-3")}>
              {formatListTime(c.lastActivityAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className={cn("flex min-w-0 flex-1 items-center gap-1 text-[13px]", unread && !preview.icon ? "text-ink-2" : preview.className)}>
              {PreviewIcon && <PreviewIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />}
              <span className="truncate">
                {preview.prefix && <span className="font-medium">{preview.prefix}</span>}
                {preview.text}
              </span>
            </p>
            {unread && (
              <span
                className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1 text-[11px] font-semibold text-white tabular-nums"
                aria-label={`${c.unreadCount} não ${c.unreadCount === 1 ? "lida" : "lidas"}`}
              >
                {c.unreadCount}
              </span>
            )}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-3">
            {crossChannel && (
              <>
                <ChannelIcon channel={c.channel} className="size-3" />
                <span className="shrink-0">{channelLabels[c.channel]}</span>
                <span className="text-ink-4" aria-hidden>
                  ·
                </span>
              </>
            )}
            <StoreDot storeId={c.storeId} className="size-1.5" />
            <span className="min-w-0 truncate">{store?.name}</span>
          </div>
          {(showState || showSla) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {showState && <StateBadge state={c.state} />}
              {showSla && <SlaIndicator conversation={c} />}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

function ListMenu() {
  const { sort, setSort } = useInbox();
  return (
    <DropdownMenu>
      <Tooltip content="Ordenar e mais opções">
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`Ordenar e mais opções. Ordem atual: ${sortLabels[sort]}`}>
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="inline-flex items-center gap-1.5">
            <ArrowDownUp className="size-3" aria-hidden />
            Ordenar por
          </span>
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as InboxSort)}>
          {(Object.keys(sortLabels) as InboxSort[]).map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {sortLabels[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/tickets">
            <Ticket aria-hidden />
            Ver em tabela de tickets
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function emptyCopy(status: InboxStatus): { title: string; description?: string } {
  switch (status) {
    case "revisao":
      return { title: "Nada para revisar agora", description: "Quando o agente de IA encaminhar uma conversa ou falhar ao responder, ela aparece aqui." };
    case "mencoes":
      return { title: "Nenhuma menção", description: "Quando alguém mencionar você em uma nota interna, a conversa aparece aqui." };
    case "participando":
      return { title: "Você não participa de nenhuma conversa", description: "Conversas atribuídas a você ou com uma nota ou mensagem sua aparecem aqui." };
    case "nao-atribuidas":
      return { title: "Tudo atribuído", description: "Nenhuma conversa espera uma pessoa sem responsável." };
    case "nao-lidas":
      return { title: "Nada não lido" };
    case "aguardando":
      return { title: "Nenhum cliente aguardando resposta" };
    case "resolvidas":
      return { title: "Nenhuma conversa resolvida" };
    default:
      return { title: "Nenhuma conversa aqui" };
  }
}

export function ConversationList() {
  const { view, filters, setFilters, visible, selectedId } = useInbox();
  const { isEmpty } = useDataset();
  const hasFilters = activeFilterCount(filters) > 0 || filters.query.length > 0;
  const copy = emptyCopy(filters.status);

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <h1 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-ink">
          {view.kind === "canal" && <ChannelIcon channel={view.channel} className="size-4 text-ink-3" />}
          <span className="truncate">{viewTitle(view)}</span>
        </h1>
        <div className="ml-auto flex items-center gap-0.5">
          <FiltersPopover />
          <ListMenu />
        </div>
      </div>
      <div className="px-3 pb-2">
        <SearchField
          label="Buscar conversas"
          placeholder="Buscar cliente, pedido ou mensagem"
          value={filters.query}
          onValueChange={(query) => setFilters((f) => ({ ...f, query }))}
        />
      </div>
      <div className="flex h-8 items-center px-3 pb-1">
        <StatusSelector />
      </div>
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
                description="Nada corresponde à busca ou aos filtros aplicados."
                action={
                  <Button size="sm" onClick={() => setFilters((f) => ({ ...emptyInboxFilters, status: f.status }))}>
                    Limpar busca e filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={InboxIcon}
                title={copy.title}
                description={copy.description}
                action={
                  filters.status !== "abertas" &&
                  filters.status !== "todas" && (
                    <Button size="sm" onClick={() => setFilters((f) => ({ ...f, status: "abertas" }))}>
                      Ver conversas abertas
                    </Button>
                  )
                }
              />
            )
          ) : (
            <ul aria-label="Conversas" className="divide-y divide-line">
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
