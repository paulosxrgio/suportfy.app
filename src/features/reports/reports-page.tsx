"use client";

import { ChartColumn, Download, FlaskConical } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import {
  BarList,
  ChartFrame,
  ColumnChart,
  Legend,
  Meter,
  SimpleTable,
  StatTile,
  seriesAiTeam,
  type ColumnPoint,
} from "@/components/shared/charts";
import { StoreLabel } from "@/components/shared/domain";
import { FilterBar, FilterMenu } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/menu";
import { channelLabels, reasonLabels } from "@/lib/demo/labels";
import { stores, useDataset, useDemo } from "@/lib/demo/store";
import type { Channel, ContactReason } from "@/lib/demo/types";
import { DEMO_NOW, formatNumber } from "@/lib/format";

type Period = "7" | "30" | "90";

/** Gerador determinístico: os números de exemplo não mudam entre renderizações. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildExample(period: Period, storeKey: string, channels: Channel[]) {
  const seedBase = Number(period) * 31 + storeKey.length * 7 + channels.length * 3;
  const rand = seeded(seedBase + 11);
  const storeFactor = storeKey === "all" ? 1 : 0.38;
  const channelFactor = channels.length === 1 ? (channels[0] === "whatsapp" ? 0.64 : 0.36) : 1;
  const scale = storeFactor * channelFactor;
  const day = 24 * 60 * 60 * 1000;

  const points: ColumnPoint[] =
    period === "90"
      ? Array.from({ length: 13 }, (_, i) => {
          const start = new Date(DEMO_NOW - (12 - i) * 7 * day);
          const ai = Math.round((210 + rand() * 90) * scale);
          const team = Math.round((70 + rand() * 45) * scale);
          const label = `Semana de ${String(start.getUTCDate()).padStart(2, "0")}/${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
          return { key: `w${i}`, label, short: `${String(start.getUTCDate()).padStart(2, "0")}/${String(start.getUTCMonth() + 1).padStart(2, "0")}`, values: [ai, team] };
        })
      : Array.from({ length: Number(period) }, (_, i) => {
          const d = new Date(DEMO_NOW - (Number(period) - 1 - i) * day);
          const weekend = [0, 6].includes(d.getUTCDay());
          const base = weekend ? 22 : 36;
          const ai = Math.round((base + rand() * 14) * scale);
          const team = Math.round((base * 0.38 + rand() * 6) * scale);
          const dd = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          return { key: `d${i}`, label: dd, short: dd, values: [ai, team] };
        });

  const totalAi = points.reduce((s, p) => s + p.values[0], 0);
  const totalTeam = points.reduce((s, p) => s + p.values[1], 0);
  const total = totalAi + totalTeam;
  const whatsappShare = channels.length === 1 ? (channels[0] === "whatsapp" ? 1 : 0) : 0.64;

  const reasons: [ContactReason, number][] = [
    ["status_pedido", 0.27],
    ["rastreamento", 0.19],
    ["troca", 0.12],
    ["duvida_produto", 0.11],
    ["prazo_entrega", 0.09],
    ["reembolso", 0.07],
    ["pagamento", 0.05],
  ];

  return {
    points,
    total,
    totalAi,
    totalTeam,
    aiRate: Math.round((totalAi / Math.max(1, total)) * 100),
    reviewRate: 24,
    failureRate: 2,
    sla: 94,
    byChannel: [
      { key: "whatsapp", label: channelLabels.whatsapp, value: Math.round(total * whatsappShare) },
      { key: "email", label: channelLabels.email, value: total - Math.round(total * whatsappShare) },
    ].filter((c) => channels.length === 0 || channels.includes(c.key as Channel)),
    byStore: stores
      .filter((s) => storeKey === "all" || s.id === storeKey)
      .map((s, i) => ({ key: s.id, label: s.name, value: storeKey === "all" ? Math.round(total * [0.48, 0.3, 0.22][i]) : total })),
    reasons: reasons.map(([id, share]) => ({ key: id, label: reasonLabels[id], value: Math.round(total * share) })),
    agents: [
      { name: "Bianca Lopes", conversas: Math.round(totalTeam * 0.38), resposta: "21 min", resolvidas: Math.round(totalTeam * 0.33), sla: "96%" },
      { name: "Thiago Mendes", conversas: Math.round(totalTeam * 0.27), resposta: "34 min", resolvidas: Math.round(totalTeam * 0.24), sla: "91%" },
      { name: "Rafael Nunes", conversas: Math.round(totalTeam * 0.2), resposta: "18 min", resolvidas: Math.round(totalTeam * 0.18), sla: "97%" },
      { name: "Camila Rocha", conversas: Math.round(totalTeam * 0.15), resposta: "52 min", resolvidas: Math.round(totalTeam * 0.13), sla: "88%" },
    ],
  };
}

function EmptyMetric({ title, description, icon = ChartColumn }: { title: string; description: string; icon?: typeof ChartColumn }) {
  return (
    <Panel title={title}>
      <EmptyState compact icon={icon} title="Sem dados no período" description={description} />
    </Panel>
  );
}

function ExampleFooter({ children }: { children?: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <DemoBadge label="Exemplo ilustrativo" />
      {children}
    </span>
  );
}

export function ReportsPage() {
  const { state } = useDemo();
  const { isEmpty } = useDataset();
  const [period, setPeriod] = useState<Period>("30");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [example, setExample] = useState(false);
  const data = useMemo(() => buildExample(period, state.store, channels), [period, state.store, channels]);
  const showExample = example && !isEmpty;

  return (
    <PageContainer>
      <PageHeader
        title="Relatórios"
        description="Métricas de atendimento da IA e da equipe, calculadas a partir das conversas reais quando os canais estiverem conectados."
        actions={
          <Tooltip content="A exportação estará disponível quando houver dados reais.">
            <span tabIndex={0} className="focus-ring rounded-md">
              <Button size="sm" disabled>
                <Download className="size-3.5" aria-hidden />
                Exportar CSV
              </Button>
            </span>
          </Tooltip>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar>
          <Segmented<Period>
            label="Período"
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: "7", label: "Últimos 7 dias" },
              { value: "30", label: "30 dias" },
              { value: "90", label: "90 dias" },
            ]}
          />
          <FilterMenu
            label="Canal"
            selected={channels}
            onChange={setChannels}
            options={(["whatsapp", "email"] as Channel[]).map((c) => ({ value: c, label: channelLabels[c] }))}
          />
          <span className="text-[13px] text-ink-3">
            Loja: {state.store === "all" ? "todas" : <StoreLabel storeId={state.store} className="text-ink-2" />}
          </span>
        </FilterBar>
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <Switch checked={example} onCheckedChange={setExample} disabled={isEmpty} />
          Mostrar exemplo ilustrativo
        </label>
      </div>

      {!showExample ? (
        <>
          <Callout tone="info" title="Ainda não há dados reais" className="mb-4">
            Os relatórios serão calculados a partir das conversas quando WhatsApp, e-mail, Shopify e o agente de IA estiverem
            conectados. Até lá, nenhuma estatística é exibida. {!isEmpty && "Ative “Mostrar exemplo ilustrativo” para ver o formato dos relatórios com números inventados."}
          </Callout>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <EmptyMetric title="Volume de conversas" description="Conversas por dia, separando as resolvidas pela IA das que tiveram participação da equipe." />
            <EmptyMetric title="Tempo de primeira resposta" description="Mediana do tempo até a primeira resposta, da IA e da equipe." />
            <EmptyMetric title="Tempo de resolução" description="Mediana do tempo entre a abertura e a resolução." />
            <EmptyMetric title="Cumprimento de SLA" description="Percentual de conversas respondidas dentro do SLA de cada prioridade." />
            <EmptyMetric title="Volume por canal" description="Distribuição entre WhatsApp e e-mail." />
            <EmptyMetric title="Volume por loja" description="Distribuição entre as lojas da organização." />
            <EmptyMetric title="Motivos de contato" description="Motivos classificados pela IA, do mais ao menos frequente." />
            <EmptyMetric title="Desempenho por atendente" description="Conversas assumidas, tempo de resposta e SLA de cada pessoa." />
            <EmptyMetric title="Participação da IA" description="Resolvidas sem intervenção, encaminhadas para revisão e falhas do agente." />
          </div>
        </>
      ) : (
        <DataGate skeleton={<div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-lg" />)}</div>}>
          <Callout tone="warning" icon={FlaskConical} title="Exemplo ilustrativo" className="mb-4">
            Todos os números desta tela são inventados para mostrar o formato dos relatórios. Eles não representam nenhuma loja nem
            o desempenho de um agente real.
          </Callout>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Conversas no período" value={formatNumber(data.total)} detail="Exemplo ilustrativo" />
              <StatTile label="Primeira resposta (mediana)" value="12 s" detail="IA · equipe: 31 min (exemplo)" />
              <StatTile label="Tempo de resolução (mediana)" value="1 h 40 min" detail="Exemplo ilustrativo" />
              <StatTile label="Resolvidas pela IA" value={`${data.aiRate}%`} detail="Sem intervenção humana (exemplo)" />
            </div>

            <ChartFrame
              title="Volume de conversas"
              description={period === "90" ? "Por semana" : "Por dia"}
              legend={<Legend series={seriesAiTeam} />}
              chart={<ColumnChart points={data.points} series={seriesAiTeam} labelEvery={period === "30" ? 5 : period === "90" ? 2 : 1} />}
              table={
                <SimpleTable
                  headers={[period === "90" ? "Semana" : "Dia", "IA", "Equipe", "Total"]}
                  rows={data.points.map((p) => [p.label, p.values[0], p.values[1], p.values[0] + p.values[1]])}
                />
              }
              footer={<ExampleFooter />}
            />

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Cumprimento de SLA" description="Respondidas dentro do SLA">
                <div className="space-y-4">
                  <Meter label="Geral" value={data.sla} target={95} />
                  <Meter label="WhatsApp" value={96} />
                  <Meter label="E-mail" value={90} />
                </div>
                <div className="mt-4">
                  <ExampleFooter />
                </div>
              </Panel>
              <ChartFrame
                title="Volume por canal"
                chart={<BarList items={data.byChannel} unit="conversas" />}
                table={<SimpleTable headers={["Canal", "Conversas"]} rows={data.byChannel.map((c) => [c.label, c.value])} />}
                footer={<ExampleFooter />}
              />
              <ChartFrame
                title="Volume por loja"
                chart={<BarList items={data.byStore} unit="conversas" />}
                table={<SimpleTable headers={["Loja", "Conversas"]} rows={data.byStore.map((c) => [c.label, c.value])} />}
                footer={<ExampleFooter />}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartFrame
                title="Motivos de contato"
                description="Classificados pelo agente de IA"
                chart={<BarList items={data.reasons} unit="conversas" />}
                table={<SimpleTable headers={["Motivo", "Conversas"]} rows={data.reasons.map((r) => [r.label, r.value])} />}
                footer={<ExampleFooter />}
              />
              <Panel title="Participação da IA" description="Como as conversas terminam">
                <div className="space-y-4">
                  <Meter label="Resolvidas sem intervenção humana" value={data.aiRate} />
                  <Meter label="Encaminhadas para revisão" value={data.reviewRate} />
                  <Meter label="Falhas do agente" value={data.failureRate} />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-ink-3">
                  Quando o agente estiver ativo, esta seção mostrará também os motivos de encaminhamento e as respostas sinalizadas
                  pela equipe.
                </p>
                <div className="mt-3">
                  <ExampleFooter />
                </div>
              </Panel>
            </div>

            <Panel title="Desempenho por atendente" description="Conversas assumidas após encaminhamento da IA" bodyClassName="p-0">
              <SimpleTable
                className="rounded-none border-0"
                headers={["Pessoa", "Conversas assumidas", "Tempo de resposta (mediana)", "Resolvidas", "SLA cumprido"]}
                rows={data.agents.map((a) => [a.name, a.conversas, a.resposta, a.resolvidas, a.sla])}
              />
              <div className="border-t border-line px-4 py-2.5">
                <ExampleFooter />
              </div>
            </Panel>
          </div>
        </DataGate>
      )}
    </PageContainer>
  );
}
