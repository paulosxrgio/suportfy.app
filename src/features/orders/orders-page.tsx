"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Package, SearchX, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import { StoreLabel } from "@/components/shared/domain";
import { FilterBar, FilterMenu, ResultCount, SearchField } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, EmptyState, ListSkeleton, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { financialStatusMeta, fulfillmentStatusMeta, orderStatusMeta } from "@/lib/demo/labels";
import { orderTotal } from "@/lib/demo/selectors";
import { stores, useDataset, useDemo } from "@/lib/demo/store";
import type { FinancialStatus, FulfillmentStatus, OrderStatus } from "@/lib/demo/types";
import { formatCurrency, formatDateShort, matchesQuery, pluralize } from "@/lib/format";
import { OrderSheet } from "./order-detail";

export function OrdersPage() {
  const { orders, allCustomers, isEmpty } = useDataset();
  const { state } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("pedido");
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [payments, setPayments] = useState<FinancialStatus[]>([]);
  const [shipments, setShipments] = useState<FulfillmentStatus[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);

  const rows = useMemo(
    () =>
      orders
        .filter((o) => {
          if (storeFilter.length && !storeFilter.includes(o.storeId)) return false;
          if (payments.length && !payments.includes(o.financialStatus)) return false;
          if (shipments.length && !shipments.includes(o.fulfillmentStatus)) return false;
          if (statuses.length && !statuses.includes(o.status)) return false;
          const customer = allCustomers.find((c) => c.id === o.customerId);
          return matchesQuery(query, o.number, o.id, customer?.name, customer?.email, o.tracking?.code);
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [orders, storeFilter, payments, shipments, statuses, query, allCustomers],
  );

  const setSelected = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("pedido", id);
    else params.delete("pedido");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const hasFilters = Boolean(query || storeFilter.length || payments.length || shipments.length || statuses.length);
  const clear = () => {
    setQuery("");
    setStoreFilter([]);
    setPayments([]);
    setShipments([]);
    setStatuses([]);
  };
  const count = (fn: (o: (typeof orders)[number]) => boolean) => orders.filter(fn).length;

  return (
    <PageContainer>
      <PageHeader
        title="Pedidos"
        description="Pedidos das lojas, usados pelo agente para informar status, pagamento e rastreio."
        meta={<DemoBadge />}
        actions={
          <Button asChild size="sm">
            <Link href="/configuracoes/shopify">
              <ShoppingBag className="size-3.5" aria-hidden />
              Conexão com a Shopify
            </Link>
          </Button>
        }
      />

      <Callout tone="warning" title="Shopify não conectada" className="mb-4">
        Os pedidos abaixo são fictícios e servem apenas para demonstrar a interface. Os dados reais, incluindo status de
        pagamento, envio e rastreio, dependerão da conexão com a Shopify de cada loja.
      </Callout>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField
          label="Buscar pedidos"
          placeholder="Buscar por número, cliente ou rastreio"
          value={query}
          onValueChange={setQuery}
          wrapperClassName="lg:w-80"
        />
        <FilterBar>
          {state.store === "all" && (
            <FilterMenu
              label="Loja"
              selected={storeFilter}
              onChange={setStoreFilter}
              options={stores.map((s) => ({ value: s.id, label: s.name, count: count((o) => o.storeId === s.id) }))}
            />
          )}
          <FilterMenu
            label="Pagamento"
            selected={payments}
            onChange={setPayments}
            options={(Object.keys(financialStatusMeta) as FinancialStatus[]).map((s) => ({
              value: s,
              label: financialStatusMeta[s].label,
              count: count((o) => o.financialStatus === s),
            }))}
          />
          <FilterMenu
            label="Envio"
            selected={shipments}
            onChange={setShipments}
            options={(Object.keys(fulfillmentStatusMeta) as FulfillmentStatus[]).map((s) => ({
              value: s,
              label: fulfillmentStatusMeta[s].label,
              count: count((o) => o.fulfillmentStatus === s),
            }))}
          />
          <FilterMenu
            label="Situação"
            selected={statuses}
            onChange={setStatuses}
            options={(Object.keys(orderStatusMeta) as OrderStatus[]).map((s) => ({
              value: s,
              label: orderStatusMeta[s].label,
              count: count((o) => o.status === s),
            }))}
          />
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Limpar
            </Button>
          )}
        </FilterBar>
      </div>

      <DataGate skeleton={<TableContainer><ListSkeleton rows={8} /></TableContainer>}>
        {isEmpty ? (
          <TableContainer>
            <EmptyState
              icon={Package}
              title="Nenhum pedido para mostrar"
              description="Conecte a Shopify para que os pedidos das lojas apareçam aqui e fiquem disponíveis para o agente de IA consultar."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href="/configuracoes/shopify">Conectar Shopify</Link>
                </Button>
              }
            />
          </TableContainer>
        ) : rows.length === 0 ? (
          <TableContainer>
            <EmptyState icon={SearchX} title="Nenhum pedido encontrado" description="Ajuste a busca ou os filtros." action={<Button size="sm" onClick={clear}>Limpar busca e filtros</Button>} />
          </TableContainer>
        ) : (
          <>
            <TableContainer>
              <Table className="min-w-[900px]">
                <thead>
                  <tr>
                    <Th>Pedido</Th>
                    <Th>Data</Th>
                    <Th>Cliente</Th>
                    <Th>Loja</Th>
                    <Th>Pagamento</Th>
                    <Th>Envio</Th>
                    <Th>Situação</Th>
                    <Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const customer = allCustomers.find((c) => c.id === o.customerId);
                    const pay = financialStatusMeta[o.financialStatus];
                    const ship = fulfillmentStatusMeta[o.fulfillmentStatus];
                    const status = orderStatusMeta[o.status];
                    return (
                      <Tr key={o.id} interactive selected={selectedId === o.id} onClick={() => setSelected(o.id)}>
                        <Td>
                          <button
                            type="button"
                            className="focus-ring rounded font-medium text-ink hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(o.id);
                            }}
                          >
                            {o.number}
                          </button>
                          <span className="block text-xs text-ink-3">
                            {pluralize(o.items.reduce((sum, i) => sum + i.quantity, 0), "item", "itens")}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap">{formatDateShort(o.createdAt)}</Td>
                        <Td className="max-w-[180px] truncate">{customer?.name}</Td>
                        <Td className="max-w-[170px]">
                          <StoreLabel storeId={o.storeId} />
                        </Td>
                        <Td>
                          <Badge tone={pay.tone} dot>
                            {pay.label}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge tone={ship.tone} dot>
                            {ship.label}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </Td>
                        <Td className="text-right font-medium text-ink tabular-nums">{formatCurrency(orderTotal(o))}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableContainer>
            <div className="mt-3">
              <ResultCount count={rows.length} singular="pedido" plural="pedidos" />
            </div>
          </>
        )}
      </DataGate>

      <OrderSheet orderId={isEmpty ? null : selectedId} onOpenChange={(open) => !open && setSelected(null)} />
    </PageContainer>
  );
}
