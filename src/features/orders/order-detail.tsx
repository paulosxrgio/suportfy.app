"use client";

import Link from "next/link";
import { ArrowLeftRight, Ban, Copy, MapPin, PackageSearch, Receipt, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { DemoBadge } from "@/components/shared/demo";
import { ChannelIcon, StateBadge, StoreLabel } from "@/components/shared/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, DefinitionList, EmptyState } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { orders as allOrders } from "@/lib/demo/data";
import { financialStatusMeta, fulfillmentStatusMeta, orderStatusMeta } from "@/lib/demo/labels";
import { orderSubtotal, orderTotal } from "@/lib/demo/selectors";
import { useDataset, useDemo } from "@/lib/demo/store";
import type { Order } from "@/lib/demo/types";
import { formatCurrency, formatDate, formatDateTime, maskEmail, maskPhone } from "@/lib/format";
import { conversationHref } from "@/features/inbox/views";

export function OrderStatusBadges({ order }: { order: Order }) {
  const pay = financialStatusMeta[order.financialStatus];
  const ship = fulfillmentStatusMeta[order.fulfillmentStatus];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={pay.tone} dot>
        {pay.label}
      </Badge>
      <Badge tone={ship.tone} dot>
        {ship.label}
      </Badge>
    </span>
  );
}

const consequentialActions = [
  { label: "Cancelar pedido", icon: Ban },
  { label: "Emitir reembolso", icon: Undo2 },
  { label: "Alterar endereço", icon: MapPin },
  { label: "Trocar produto", icon: ArrowLeftRight },
];

/** Ações com consequências: visíveis, porém bloqueadas até existirem ferramentas validadas no servidor. */
export function ConsequentialActions({ compact }: { compact?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {consequentialActions.map(({ label, icon: Icon }) => (
          <Tooltip
            key={label}
            content="Sujeita a regras e validação. Será executada apenas por ferramenta controlada pelo servidor; ainda não implementada."
          >
            <span tabIndex={0} className="focus-ring rounded-md">
              <Button size={compact ? "xs" : "sm"} variant="secondary" disabled aria-label={`${label} (indisponível)`}>
                <Icon className="size-3.5" aria-hidden />
                {label}
              </Button>
            </span>
          </Tooltip>
        ))}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        Sujeitas a regras e validação. Nem o agente de IA nem esta tela executam essas ações a partir de texto livre; elas
        dependerão de ferramentas no servidor com validações determinísticas, ainda não implementadas.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-ink-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

export function OrderDetail({ order }: { order: Order }) {
  const { state } = useDemo();
  const { allCustomers } = useDataset();
  const customer = allCustomers.find((c) => c.id === order.customerId);
  const related = state.conversations.filter((c) => c.orderIds.includes(order.id));
  const status = orderStatusMeta[order.status];

  return (
    <div>
      <div className="space-y-3 border-b border-line px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadges order={order} />
          <Badge tone={status.tone}>{status.label}</Badge>
          <DemoBadge />
        </div>
        <p className="text-[13px] text-ink-3">
          Criado em {formatDateTime(order.createdAt)} · <StoreLabel storeId={order.storeId} />
        </p>
        <Callout tone="neutral">
          Pedido fictício. Com a Shopify conectada, itens, pagamento e rastreio virão da loja, e o agente só informará o que
          constar nesses dados.
        </Callout>
      </div>

      <Section title="Itens">
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.sku} className="flex items-start justify-between gap-3 py-2 first:pt-0">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{item.title}</p>
                <p className="text-xs text-ink-3">
                  {item.variant ? `${item.variant} · ` : ""}SKU {item.sku}
                </p>
              </div>
              <p className="shrink-0 text-right text-[13px] text-ink-2 tabular-nums">
                {item.quantity} × {formatCurrency(item.unitPrice)}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[13px] tabular-nums">
          <div className="flex justify-between text-ink-2">
            <dt>Subtotal</dt>
            <dd>{formatCurrency(orderSubtotal(order))}</dd>
          </div>
          <div className="flex justify-between text-ink-2">
            <dt>Frete</dt>
            <dd>{order.shipping ? formatCurrency(order.shipping) : "Grátis"}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-ink-2">
              <dt>Desconto</dt>
              <dd>{formatCurrency(-order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium text-ink">
            <dt>Total</dt>
            <dd>{formatCurrency(orderTotal(order))}</dd>
          </div>
          {order.refunded > 0 && (
            <div className="flex justify-between text-ink-3">
              <dt>Reembolsado</dt>
              <dd>{formatCurrency(-order.refunded)}</dd>
            </div>
          )}
        </dl>
      </Section>

      <Section title="Cliente e entrega">
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
            { term: "E-mail", value: customer ? maskEmail(customer.email) : "—" },
            { term: "Telefone", value: customer?.phone ? maskPhone(customer.phone) : "Não informado" },
            { term: "Endereço", value: order.address.line },
            { term: "Cidade", value: order.address.city },
            { term: "CEP", value: order.address.zip },
          ]}
        />
        <p className="mt-2 text-xs text-ink-3">Endereço e contatos parcialmente ocultos para proteger dados pessoais.</p>
      </Section>

      <Section title="Pagamento">
        <DefinitionList
          items={[
            { term: "Situação", value: financialStatusMeta[order.financialStatus].label },
            { term: "Forma", value: order.paymentMethod },
            { term: "Total", value: formatCurrency(orderTotal(order)) },
          ]}
        />
      </Section>

      <Section title="Rastreamento">
        {order.tracking ? (
          <>
            <DefinitionList
              items={[
                { term: "Transportadora", value: order.tracking.carrier },
                {
                  term: "Código",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-mono text-[12.5px]">{order.tracking.code}</span>
                      <button
                        type="button"
                        className="focus-ring rounded p-0.5 text-ink-3 hover:text-ink"
                        aria-label="Copiar código de rastreio"
                        onClick={() => {
                          void navigator.clipboard?.writeText(order.tracking!.code).catch(() => undefined);
                          toast.success("Código copiado", { description: "Código fictício, apenas para demonstração." });
                        }}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </span>
                  ),
                },
                { term: "Previsão", value: formatDate(order.tracking.estimatedDelivery) },
              ]}
            />
            <ol className="mt-4 space-y-3 border-l border-line pl-4">
              {[...order.tracking.events].reverse().map((e, i) => (
                <li key={e.at} className="relative">
                  <span
                    className={`absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-2 ring-surface ${i === 0 ? "bg-primary-500" : "bg-line-strong"}`}
                    aria-hidden
                  />
                  <p className="text-[13px] text-ink">{e.description}</p>
                  <p className="text-xs text-ink-3">
                    {formatDateTime(e.at)}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <EmptyState
            compact
            icon={PackageSearch}
            title="Sem rastreio"
            description={
              order.fulfillmentStatus === "cancelado" ? "Pedido cancelado antes do envio." : "O pedido ainda não foi enviado."
            }
          />
        )}
      </Section>

      <Section title="Conversas relacionadas">
        {related.length ? (
          <ul className="space-y-1">
            {related.map((c) => (
              <li key={c.id}>
                <Link
                  href={conversationHref(c)}
                  className="focus-ring flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 text-[13px] hover:bg-subtle"
                >
                  <ChannelIcon channel={c.channel} className="text-ink-3" />
                  <span className="min-w-0 flex-1 truncate text-ink">{c.subject}</span>
                  <StateBadge state={c.state} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">Nenhuma conversa sobre este pedido.</p>
        )}
      </Section>

      <Section title="Ações do pedido">
        <ConsequentialActions />
      </Section>
    </div>
  );
}

/** Painel lateral com o detalhe de um pedido. Controlado por `orderId` (null fecha). */
export function OrderSheet({ orderId, onOpenChange }: { orderId: string | null; onOpenChange: (open: boolean) => void }) {
  const order = orderId ? allOrders.find((o) => o.id === orderId) : undefined;
  return (
    <Sheet open={Boolean(orderId)} onOpenChange={onOpenChange}>
      {order && (
        <SheetContent
          title={
            <span className="inline-flex items-center gap-2">
              <Receipt className="size-4 text-ink-3" aria-hidden />
              Pedido {order.number}
            </span>
          }
          description="Detalhes do pedido na loja"
          width="w-[min(100vw,460px)]"
        >
          <OrderDetail order={order} />
        </SheetContent>
      )}
    </Sheet>
  );
}
