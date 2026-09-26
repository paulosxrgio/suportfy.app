"use client";

import { useRouter } from "next/navigation";
import { Package, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import { StoreLabel } from "@/components/shared/domain";
import { FilterBar, FilterMenu, ResultCount, SearchField } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, ListSkeleton, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { customerStats } from "@/lib/demo/selectors";
import { stores, useDataset, useDemo } from "@/lib/demo/store";
import { formatCurrency, formatListTime, maskEmail, maskPhone, matchesQuery } from "@/lib/format";

export function CustomersPage() {
  const { customers, allOrders, allConversations, isEmpty } = useDataset();
  const { state } = useDemo();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const allTags = Array.from(new Set(customers.flatMap((c) => c.tags))).sort();

  const rows = useMemo(
    () =>
      customers
        .filter((c) => {
          if (storeFilter.length && !storeFilter.includes(c.storeId)) return false;
          if (tags.length && !tags.some((t) => c.tags.includes(t))) return false;
          return matchesQuery(query, c.name, c.email, c.phone);
        })
        .map((c) => ({ customer: c, stats: customerStats(c, allOrders, allConversations) }))
        .sort((a, b) => Date.parse(b.stats.lastActivityAt) - Date.parse(a.stats.lastActivityAt)),
    [customers, storeFilter, tags, query, allOrders, allConversations],
  );

  const hasFilters = Boolean(query || storeFilter.length || tags.length);
  const clear = () => {
    setQuery("");
    setStoreFilter([]);
    setTags([]);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Clientes"
        description="Contatos das lojas com pedidos e conversas. Com a Shopify conectada, os dados virão das lojas."
        meta={<DemoBadge />}
        actions={
          <Button asChild size="sm">
            <Link href="/pedidos">
              <Package className="size-3.5" aria-hidden />
              Ver todos os pedidos
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchField
          label="Buscar clientes"
          placeholder="Buscar por nome, e-mail ou telefone"
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
              options={stores.map((s) => ({ value: s.id, label: s.name, count: customers.filter((c) => c.storeId === s.id).length }))}
            />
          )}
          <FilterMenu
            label="Tag"
            selected={tags}
            onChange={setTags}
            options={allTags.map((t) => ({ value: t, label: t === "vip" ? "VIP" : t, count: customers.filter((c) => c.tags.includes(t)).length }))}
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
              icon={Users}
              title="Nenhum cliente ainda"
              description="Clientes são importados da Shopify e criados a partir das conversas. Conecte a Shopify para trazer os contatos das lojas."
              action={
                <Button asChild size="sm" variant="primary">
                  <Link href="/configuracoes/shopify">Conectar Shopify</Link>
                </Button>
              }
            />
          </TableContainer>
        ) : rows.length === 0 ? (
          <TableContainer>
            <EmptyState icon={SearchX} title="Nenhum cliente encontrado" description="Tente buscar por outra parte do nome, e-mail ou telefone." action={<Button size="sm" onClick={clear}>Limpar busca e filtros</Button>} />
          </TableContainer>
        ) : (
          <>
            <TableContainer>
              <Table className="min-w-[860px]">
                <thead>
                  <tr>
                    <Th>Cliente</Th>
                    <Th>Telefone</Th>
                    <Th>Loja</Th>
                    <Th className="text-right">Pedidos</Th>
                    <Th className="text-right">Total gasto</Th>
                    <Th className="text-right">Conversas</Th>
                    <Th className="text-right">Última atividade</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ customer: c, stats }) => (
                    <Tr key={c.id} interactive onClick={() => router.push(`/clientes/${c.id}`)}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={c.name} />
                          <span className="min-w-0">
                            <Link
                              href={`/clientes/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="focus-ring flex items-center gap-1.5 rounded font-medium text-ink hover:underline"
                            >
                              {c.name}
                              {c.tags.includes("vip") && <Badge tone="primary">VIP</Badge>}
                            </Link>
                            <span className="block text-xs text-ink-3">{maskEmail(c.email)}</span>
                          </span>
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">{c.phone ? maskPhone(c.phone) : <span className="text-ink-4">—</span>}</Td>
                      <Td className="max-w-[170px]">
                        <StoreLabel storeId={c.storeId} />
                      </Td>
                      <Td className="text-right tabular-nums">{stats.ordersCount}</Td>
                      <Td className="text-right tabular-nums">{stats.ordersCount ? formatCurrency(stats.totalSpent) : <span className="text-ink-4">—</span>}</Td>
                      <Td className="text-right tabular-nums">{stats.conversationsCount}</Td>
                      <Td className="text-right whitespace-nowrap text-ink-3 tabular-nums">{formatListTime(stats.lastActivityAt)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <ResultCount count={rows.length} singular="cliente" plural="clientes" />
              <p className="text-xs text-ink-3">E-mails e telefones aparecem parcialmente ocultos. A busca considera o valor completo.</p>
            </div>
          </>
        )}
      </DataGate>
    </PageContainer>
  );
}
