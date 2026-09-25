"use client";

import Link from "next/link";
import { Bot, ChevronDown, Mail, MapPin, Phone, Plus, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DemoBadge } from "@/components/shared/demo";
import { AssigneeLabel, ChannelLabel, SlaIndicator, StateBadge, StoreLabel, TagChip } from "@/components/shared/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, DefinitionList } from "@/components/ui/data";
import { Textarea } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { orders as allOrders, teams } from "@/lib/demo/data";
import { priorityMeta, reasonLabels, ticketStatusMeta } from "@/lib/demo/labels";
import { orderTotal, ticketStatus } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import type { Conversation } from "@/lib/demo/types";
import { formatCurrency, formatDateShort, formatDateTime, formatListTime, maskEmail, maskPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderStatusBadges } from "@/features/orders/order-detail";

function PanelSection({ title, action, children, defaultOpen = true }: { title: string; action?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="focus-ring -ml-1 flex flex-1 items-center gap-1 rounded px-1 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase"
        >
          <ChevronDown className={cn("size-3.5 text-ink-4 transition-transform", !open && "-rotate-90")} aria-hidden />
          {title}
        </button>
        {action}
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export function CustomerPanel({ conversation, onOpenOrder }: { conversation: Conversation; onOpenOrder: (id: string) => void }) {
  const { state, actions } = useDemo();
  const { allCustomers, allConversations } = useDataset();
  const customer = allCustomers.find((c) => c.id === conversation.customerId);
  const [note, setNote] = useState("");
  if (!customer) return null;

  const customerOrders = allOrders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => Number(conversation.orderIds.includes(b.id)) - Number(conversation.orderIds.includes(a.id)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const history = allConversations
    .filter((c) => c.customerId === customer.id && c.id !== conversation.id)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
  const team = teams.find((t) => t.id === conversation.teamId);
  const status = ticketStatusMeta[ticketStatus(conversation.state)];

  return (
    <div className="text-[13px]">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start gap-3">
          <Avatar name={customer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{customer.name}</p>
            <p className="text-xs text-ink-3">Cliente desde {formatDateShort(customer.customerSince)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {customer.tags.map((t) => (
                <Badge key={t} tone={t === "vip" ? "primary" : "neutral"}>
                  {t.toUpperCase() === "VIP" ? "VIP" : t}
                </Badge>
              ))}
              <DemoBadge label="Fictício" />
            </div>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-ink-2">
          <li className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0 text-ink-4" aria-hidden />
            <span className="truncate" title="E-mail parcialmente oculto">
              {maskEmail(customer.email)}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0 text-ink-4" aria-hidden />
            {customer.phone ? maskPhone(customer.phone) : <span className="text-ink-3">Telefone não informado</span>}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-3.5 shrink-0 text-ink-4" aria-hidden />
            {customer.city}
          </li>
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <StoreLabel storeId={customer.storeId} className="text-xs text-ink-3" />
          <Link href={`/clientes/${customer.id}`} className="focus-ring rounded text-xs font-medium text-primary-700 hover:underline">
            Ver perfil completo
          </Link>
        </div>
      </div>

      <PanelSection title="Resumo da IA">
        <div className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <Sparkles className="size-3.5 text-primary-600" aria-hidden />
            Motivo: <span className="font-medium text-ink-2">{reasonLabels[conversation.reason]}</span>
          </p>
          <p className="leading-relaxed text-ink-2">{conversation.aiSummary}</p>
          {conversation.aiSuggestion && (
            <div className="rounded-md border border-primary-200 bg-primary-50/70 px-3 py-2">
              <p className="mb-0.5 flex items-center gap-1 text-xs font-medium text-primary-800">
                <Bot className="size-3.5" aria-hidden />
                Sugestão do agente · não executada
              </p>
              <p className="leading-relaxed text-ink-2">{conversation.aiSuggestion}</p>
            </div>
          )}
        </div>
      </PanelSection>

      <PanelSection title={`Pedidos (${customerOrders.length})`}>
        {customerOrders.length === 0 ? (
          <p className="text-ink-3">
            Nenhum pedido encontrado para este contato. A IA pede o número do pedido em vez de supor qual é.
          </p>
        ) : (
          <ul className="-mx-2 space-y-1">
            {customerOrders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => onOpenOrder(o.id)}
                  className={cn(
                    "focus-ring w-full rounded-md px-2 py-2 text-left hover:bg-subtle",
                    conversation.orderIds.includes(o.id) && "bg-canvas ring-1 ring-line ring-inset",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{o.number}</span>
                    <span className="text-ink-2 tabular-nums">{formatCurrency(orderTotal(o))}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {formatDateShort(o.createdAt)} · {o.items.map((i) => i.title).join(", ")}
                  </span>
                  <span className="mt-1.5 block">
                    <OrderStatusBadges order={o} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-3">Pedidos fictícios. Os reais virão da Shopify quando conectada.</p>
      </PanelSection>

      <PanelSection title="Detalhes do ticket">
        <DefinitionList
          items={[
            { term: "Ticket", value: `#${conversation.ticketNumber}` },
            { term: "Status", value: <Badge tone={status.tone}>{status.label}</Badge> },
            { term: "Estado", value: <StateBadge state={conversation.state} /> },
            { term: "Canal", value: <ChannelLabel channel={conversation.channel} /> },
            { term: "Prioridade", value: priorityMeta[conversation.priority].label },
            { term: "Responsável", value: <AssigneeLabel conversation={conversation} /> },
            { term: "Equipe", value: team?.name ?? "—" },
            { term: "SLA", value: <SlaIndicator conversation={conversation} variant="full" /> },
            { term: "Aberto em", value: formatDateTime(conversation.createdAt) },
          ]}
        />
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs text-ink-3">Tags</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="xs" variant="ghost" aria-label="Editar tags">
                  <Plus className="size-3.5" aria-hidden />
                  Tags
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Tags da conversa</DropdownMenuLabel>
                {state.tags.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.id}
                    checked={conversation.tags.includes(t.name)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => actions.toggleTag(conversation.id, t.name)}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                    {t.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap gap-1">
            {conversation.tags.length ? (
              conversation.tags.map((t) => <TagChip key={t} name={t} onRemove={() => actions.toggleTag(conversation.id, t)} />)
            ) : (
              <p className="text-xs text-ink-3">Sem tags.</p>
            )}
          </div>
        </div>
      </PanelSection>

      <PanelSection title={`Histórico (${history.length})`} defaultOpen={history.length > 0}>
        {history.length === 0 ? (
          <p className="text-ink-3">Primeira conversa deste cliente.</p>
        ) : (
          <ul className="-mx-2 space-y-0.5">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/inbox/${h.id}`} className="focus-ring block rounded-md px-2 py-1.5 hover:bg-subtle">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink">{h.subject}</span>
                    <span className="shrink-0 text-xs text-ink-3">{formatListTime(h.lastActivityAt)}</span>
                  </span>
                  <span className="mt-1 block">
                    <StateBadge state={h.state} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title="Observações">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!note.trim()) return;
            actions.addCustomerNote(customer.id, note.trim());
            setNote("");
            toast.success("Observação adicionada", { description: "Mantida apenas nesta sessão de demonstração." });
          }}
          className="space-y-2"
        >
          <label htmlFor="customer-note" className="sr-only">
            Nova observação sobre o cliente
          </label>
          <Textarea
            id="customer-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Algo que a equipe deve saber sobre este cliente"
            className="min-h-16 text-[13px]"
          />
          <Button type="submit" size="xs" disabled={!note.trim()}>
            Adicionar observação
          </Button>
        </form>
        <ul className="mt-3 space-y-2">
          {customer.notes.map((n) => {
            const author = n.authorId === CURRENT_USER_ID ? "Você" : state.members.find((m) => m.id === n.authorId)?.name;
            return (
              <li key={n.id} className="rounded-md border border-line bg-canvas px-2.5 py-2">
                <p className="leading-relaxed text-ink-2">{n.body}</p>
                <p className="mt-1 text-xs text-ink-3">
                  {author} · {formatDateTime(n.at)}
                </p>
              </li>
            );
          })}
        </ul>
      </PanelSection>
    </div>
  );
}
