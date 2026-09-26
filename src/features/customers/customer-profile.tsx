"use client";

import Link from "next/link";
import { Eye, EyeOff, Mail, MapPin, MessagesSquare, Phone, Receipt } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DemoBadge } from "@/components/shared/demo";
import { ChannelIcon, StateBadge, StoreLabel } from "@/components/shared/domain";
import { NotFoundContent } from "@/components/shared/not-found-content";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatTile } from "@/components/shared/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Avatar, EmptyState, Panel, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Textarea } from "@/components/ui/field";
import { OrderSheet, OrderStatusBadges } from "@/features/orders/order-detail";
import { reasonLabels } from "@/lib/demo/labels";
import { customerStats, orderTotal } from "@/lib/demo/selectors";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import { formatCurrency, formatDateShort, formatDateTime, formatListTime, maskEmail, maskPhone } from "@/lib/format";
import { conversationHref } from "@/features/inbox/views";

export function CustomerProfile({ id }: { id: string }) {
  const { state, actions } = useDemo();
  const { allCustomers, allOrders, allConversations } = useDataset();
  const customer = allCustomers.find((c) => c.id === id);
  const [revealed, setRevealed] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!customer) {
    return (
      <NotFoundContent
        title="Cliente não encontrado"
        description="O cliente pode não existir nesta demonstração ou a conta está sem dados."
        href="/clientes"
        cta="Voltar para clientes"
      />
    );
  }

  const stats = customerStats(customer, allOrders, allConversations);
  const orders = allOrders.filter((o) => o.customerId === customer.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const conversations = allConversations
    .filter((c) => c.customerId === customer.id)
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
  const validOrders = orders.filter((o) => o.status !== "cancelado").length;

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: "Clientes", href: "/clientes" }, { label: customer.name }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={customer.name} size="lg" />
            {customer.name}
          </span>
        }
        meta={
          <>
            {customer.tags.map((t) => (
              <Badge key={t} tone={t === "vip" ? "primary" : "neutral"}>
                {t === "vip" ? "VIP" : t}
              </Badge>
            ))}
            <DemoBadge label="Cliente fictício" />
          </>
        }
        actions={
          conversations[0] && (
            <Button asChild size="sm" variant="primary">
              <Link href={conversationHref(conversations[0])}>
                <MessagesSquare className="size-3.5" aria-hidden />
                Abrir conversa mais recente
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Pedidos" value={stats.ordersCount} />
            <StatTile label="Total gasto" value={stats.ordersCount ? formatCurrency(stats.totalSpent) : "—"} />
            <StatTile label="Ticket médio" value={validOrders ? formatCurrency(stats.totalSpent / validOrders) : "—"} />
            <StatTile label="Conversas" value={stats.conversationsCount} />
          </div>

          <Tabs defaultValue="conversas">
            <TabsList>
              <TabsTrigger value="conversas">Conversas ({conversations.length})</TabsTrigger>
              <TabsTrigger value="pedidos">Pedidos ({orders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="conversas" className="pt-3 focus:outline-none">
              {conversations.length === 0 ? (
                <Panel>
                  <EmptyState compact icon={MessagesSquare} title="Sem conversas" description="Este cliente ainda não entrou em contato." />
                </Panel>
              ) : (
                <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link href={conversationHref(c)} className="focus-ring flex items-start gap-3 px-4 py-3 hover:bg-canvas">
                        <ChannelIcon channel={c.channel} className="mt-1 text-ink-3" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium text-ink">{c.subject}</span>
                            <StateBadge state={c.state} />
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{c.aiSummary}</p>
                          <p className="mt-1 text-xs text-ink-3">
                            Ticket #{c.ticketNumber} · {reasonLabels[c.reason]}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-3">{formatListTime(c.lastActivityAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="pedidos" className="pt-3 focus:outline-none">
              {orders.length === 0 ? (
                <Panel>
                  <EmptyState compact icon={Receipt} title="Nenhum pedido vinculado" description="Nenhum pedido foi encontrado para este contato nos dados de demonstração." />
                </Panel>
              ) : (
                <TableContainer>
                  <Table className="min-w-[560px]">
                    <thead>
                      <tr>
                        <Th>Pedido</Th>
                        <Th>Data</Th>
                        <Th>Situação</Th>
                        <Th className="text-right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <Tr key={o.id} interactive onClick={() => setOrderId(o.id)}>
                          <Td>
                            <button
                              type="button"
                              className="focus-ring rounded font-medium text-ink hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOrderId(o.id);
                              }}
                            >
                              {o.number}
                            </button>
                            <span className="block max-w-64 truncate text-xs text-ink-3">{o.items.map((i) => i.title).join(", ")}</span>
                          </Td>
                          <Td className="whitespace-nowrap">{formatDateShort(o.createdAt)}</Td>
                          <Td>
                            <OrderStatusBadges order={o} />
                          </Td>
                          <Td className="text-right tabular-nums">{formatCurrency(orderTotal(o))}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableContainer>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Panel
            title="Contato"
            actions={
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  if (!revealed) actions.log("Visualizou contato completo do cliente", customer.name);
                  setRevealed((v) => !v);
                }}
              >
                {revealed ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                {revealed ? "Ocultar" : "Mostrar completo"}
              </Button>
            }
          >
            <ul className="space-y-2 text-[13px] text-ink-2">
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 text-ink-4" aria-hidden />
                <span className="truncate">{revealed ? customer.email : maskEmail(customer.email)}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-3.5 text-ink-4" aria-hidden />
                {customer.phone ? (revealed ? customer.phone : maskPhone(customer.phone)) : <span className="text-ink-3">Não informado</span>}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-3.5 text-ink-4" aria-hidden />
                {customer.city}
              </li>
            </ul>
            <div className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-3">
              <p>
                Loja: <StoreLabel storeId={customer.storeId} className="text-ink-2" />
              </p>
              <p>Cliente desde {formatDateShort(customer.customerSince)}</p>
              <p>Última atividade {formatDateTime(stats.lastActivityAt)}</p>
            </div>
            <p className="mt-3 text-xs text-ink-3">Mostrar o contato completo fica registrado na auditoria.</p>
          </Panel>

          <Panel title="Observações">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                actions.addCustomerNote(customer.id, note.trim());
                setNote("");
                toast.success("Observação adicionada", { description: "Mantida apenas nesta sessão." });
              }}
              className="space-y-2"
            >
              <label htmlFor="profile-note" className="sr-only">
                Nova observação
              </label>
              <Textarea id="profile-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Algo que a equipe deve saber" className="min-h-16 text-[13px]" />
              <Button type="submit" size="xs" disabled={!note.trim()}>
                Adicionar observação
              </Button>
            </form>
            {customer.notes.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {customer.notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-line bg-canvas px-2.5 py-2 text-[13px]">
                    <p className="leading-relaxed text-ink-2">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {n.authorId === CURRENT_USER_ID ? "Você" : state.members.find((m) => m.id === n.authorId)?.name} · {formatDateTime(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-ink-3">Nenhuma observação registrada.</p>
            )}
          </Panel>
        </aside>
      </div>

      <OrderSheet orderId={orderId} onOpenChange={(open) => !open && setOrderId(null)} />
    </PageContainer>
  );
}
