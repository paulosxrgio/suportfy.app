"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  CircleCheck,
  Inbox,
  KeyRound,
  Mail,
  MessageCircle,
  Settings,
  ShoppingBag,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import { ChartFrame, Legend, SimpleTable, StackedBars, StatTile, seriesAiTeam } from "@/components/shared/charts";
import { ChannelIcon, IntegrationBadge, SlaIndicator, StateBadge, StoreDot, storeById } from "@/components/shared/domain";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ListSkeleton, Panel, Skeleton } from "@/components/ui/data";
import { organization } from "@/lib/demo/data";
import { channelLabels } from "@/lib/demo/labels";
import { inQueue, isToday, slaInfo, sortConversations, ticketStatus } from "@/lib/demo/selectors";
import { useDataset } from "@/lib/demo/store";
import type { Channel, Conversation, TimelineItem } from "@/lib/demo/types";
import { formatListTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { conversationHref } from "@/features/inbox/views";

function aiHandled(c: Conversation) {
  return inQueue(c, "ia") || c.state === "auto_resolved";
}

function AgentSummary() {
  const { agent, conversations } = useDataset();
  const channels = Object.values(agent.channels).flatMap((c) => Object.values(c));
  const auto = channels.filter((c) => c.mode === "auto" && !c.paused).length;
  const copilot = channels.filter((c) => c.mode === "copilot" && !c.paused).length;
  const resolvedToday = conversations.filter((c) => isToday(c.lastActivityAt) && ticketStatus(c.state) === "resolvido");
  const byAi = resolvedToday.filter((c) => c.state === "auto_resolved").length;
  const handled = conversations.filter(aiHandled).length;

  return (
    <section className="rounded-lg border border-line bg-surface" aria-label="Agente de IA">
      <div className="flex flex-wrap items-start gap-4 px-4 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 ring-1 ring-primary-200">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Agente de IA</h2>
            <span className="text-[13px] text-ink-3">
              {agent.orgPaused ? "Pausado em toda a organização" : `Automático em ${auto} de ${channels.length} canais`}
              {!agent.orgPaused && copilot > 0 && ` · copiloto em ${copilot}`}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            O agente atende primeiro e encaminha exceções para revisão. Nenhum modelo está conectado: sem a chave da OpenAI
            configurada no servidor, nenhuma resposta automática é gerada. Os números abaixo vêm dos dados de demonstração.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/agente">Configurar agente</Link>
          </Button>
          <Button asChild size="sm" variant="primary">
            <Link href="/configuracoes/inteligencia-artificial">
              <KeyRound className="size-3.5" aria-hidden />
              Conectar OpenAI
            </Link>
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg border-t border-line bg-line sm:grid-cols-4">
        {[
          { term: "Com a IA agora", value: conversations.filter((c) => inQueue(c, "ia")).length },
          { term: "Resolvidas pela IA hoje", value: byAi },
          { term: "Resolvidas pela equipe hoje", value: resolvedToday.length - byAi },
          {
            term: "Conduzidas pela IA",
            value: conversations.length ? `${Math.round((handled / conversations.length) * 100)}%` : "—",
          },
        ].map((item) => (
          <div key={item.term} className="bg-surface px-4 py-3">
            <dt className="text-xs text-ink-3">{item.term}</dt>
            <dd className="mt-0.5 text-lg font-semibold text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Kpis() {
  const { conversations } = useDataset();
  const open = conversations.filter((c) => ticketStatus(c.state) === "aberto");
  const pending = conversations.filter((c) => ticketStatus(c.state) === "pendente");
  const resolvedToday = conversations.filter((c) => ticketStatus(c.state) === "resolvido" && isToday(c.lastActivityAt));
  const review = conversations.filter((c) => inQueue(c, "revisao"));
  const breached = conversations.filter((c) => slaInfo(c).status === "vencido");
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Abertas"
        value={open.length}
        detail={`${open.filter((c) => c.state === "ai_active").length} com a IA · ${open.filter((c) => !aiHandled(c)).length} com pessoas ou em revisão`}
        href="/inbox"
      />
      <StatTile label="Pendentes" value={pending.length} detail="Aguardando retorno do cliente" href="/inbox" />
      <StatTile
        label="Resolvidas hoje"
        value={resolvedToday.length}
        detail={`${resolvedToday.filter((c) => c.state === "auto_resolved").length} pela IA · ${resolvedToday.filter((c) => c.state === "resolved").length} pela equipe`}
        href="/tickets"
      />
      <StatTile
        label="Precisam de revisão"
        value={review.length}
        attention={review.length > 0}
        detail={breached.length ? `${breached.length} com SLA vencido` : "Nenhum SLA vencido"}
        href="/inbox"
      />
    </div>
  );
}

function Exceptions() {
  const { conversations, allCustomers } = useDataset();
  const items = sortConversations(
    conversations.filter((c) => inQueue(c, "revisao") || c.state === "agent_paused" || slaInfo(c).status === "vencido"),
    "prioridade",
  );
  return (
    <Panel
      title="Exceções que precisam de atenção"
      description="Conversas que o agente encaminhou, em que falhou ou com SLA vencido."
      actions={
        <Button asChild size="xs" variant="ghost">
          <Link href="/inbox">
            Abrir conversas
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Button>
      }
      bodyClassName="p-0"
    >
      <DataGate skeleton={<ListSkeleton rows={4} />}>
        {items.length === 0 ? (
          <EmptyState compact icon={CircleCheck} title="Nenhuma exceção no momento" description="Quando o agente encaminhar uma conversa ou falhar, ela aparece aqui." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((c) => {
              const customer = allCustomers.find((cu) => cu.id === c.customerId);
              const reason = c.state === "agent_error" ? c.error : (c.handoff?.reason ?? c.aiSummary);
              return (
                <li key={c.id}>
                  <Link href={conversationHref(c)} className="focus-ring flex items-start gap-3 px-4 py-3 hover:bg-canvas">
                    <ChannelIcon channel={c.channel} className="mt-1 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-ink">{customer?.name}</span>
                        <StateBadge state={c.state} />
                        <span className="flex items-center gap-1 text-xs text-ink-3">
                          <StoreDot storeId={c.storeId} />
                          {storeById(c.storeId)?.name}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{reason}</p>
                    </div>
                    <SlaIndicator conversation={c} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DataGate>
    </Panel>
  );
}

function IntegrationRow({ icon: Icon, name, detail, href }: { icon: LucideIcon; name: string; detail: string; href: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-ink-3">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{name}</p>
        <p className="truncate text-xs text-ink-3">{detail}</p>
      </div>
      <IntegrationBadge state="nao_configurado" labels={name === "OpenAI" ? { nao_configurado: "Não configurada" } : undefined} />
      <Button asChild size="xs" variant="ghost">
        <Link href={href} aria-label={`Configurar ${name}`}>
          Configurar
        </Link>
      </Button>
    </li>
  );
}

function SetupPanel() {
  const { knowledge, isEmpty } = useDataset();
  const published = knowledge.filter((k) => k.status === "publicado").length;
  const drafts = knowledge.filter((k) => k.status === "rascunho").length;
  return (
    <Panel title="Estado das integrações" description="Estado real desta instalação: nenhuma integração foi implementada ainda.">
      <ul className="divide-y divide-line">
        <IntegrationRow icon={ShoppingBag} name="Shopify" detail="Pedidos, clientes e produtos das lojas" href="/configuracoes/shopify" />
        <IntegrationRow icon={MessageCircle} name="WhatsApp" detail="Via Evolution API" href="/configuracoes/whatsapp" />
        <IntegrationRow icon={Mail} name="E-mail" detail="Envio via Resend e caixa de entrada" href="/configuracoes/email" />
        <IntegrationRow icon={KeyRound} name="OpenAI" detail="Modelo usado pelo agente de IA" href="/configuracoes/inteligencia-artificial" />
      </ul>
      <div className="mt-4 flex items-center gap-3 rounded-md border border-line bg-canvas px-3 py-2.5">
        <BookOpen className="size-4 shrink-0 text-ink-3" aria-hidden />
        <p className="min-w-0 flex-1 text-[13px] text-ink-2">
          {isEmpty ? (
            "Nenhum conteúdo na base de conhecimento."
          ) : (
            <>
              {published} publicados · {drafts} em rascunho <span className="text-ink-3">(demonstração)</span>
            </>
          )}
        </p>
        <Button asChild size="xs" variant="ghost">
          <Link href="/conhecimento">Ver</Link>
        </Button>
      </div>
    </Panel>
  );
}

function ChannelChart() {
  const { conversations } = useDataset();
  const channels: Channel[] = ["whatsapp", "email"];
  const rows = channels.map((ch) => {
    const list = conversations.filter((c) => c.channel === ch);
    const ai = list.filter(aiHandled).length;
    return { key: ch, label: channelLabels[ch], values: [ai, list.length - ai] };
  });
  const empty = conversations.length === 0;
  return (
    <ChartFrame
      title="Conversas por canal"
      description="Todas as conversas do conjunto de demonstração, por quem conduz."
      legend={!empty && <Legend series={seriesAiTeam} />}
      chart={
        <DataGate skeleton={<Skeleton className="h-20 w-full" />}>
          {empty ? (
            <EmptyState compact icon={MessageCircle} title="Sem conversas" description="O volume por canal aparece quando WhatsApp ou e-mail estiverem conectados." />
          ) : (
            <StackedBars
              rows={rows.map((r) => ({
                ...r,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <ChannelIcon channel={r.key as Channel} className="text-ink-3" />
                    {r.label}
                  </span>
                ),
              }))}
              series={seriesAiTeam}
            />
          )}
        </DataGate>
      }
      table={
        <SimpleTable
          headers={["Canal", "Com a IA", "Com a equipe", "Total"]}
          rows={rows.map((r) => [r.label, r.values[0], r.values[1], r.values[0] + r.values[1]])}
        />
      }
      footer={<DemoBadge />}
    />
  );
}

type Activity = { item: TimelineItem; conversation: Conversation };

function activityText(a: Activity, customerName: string) {
  const { item } = a;
  if (item.type === "event") return item.text;
  if (item.type === "note") return "Nota interna adicionada";
  if (item.author === "ai") return item.approvedBy ? "Resposta da IA aprovada" : "IA respondeu";
  if (item.author === "agent") return "Equipe respondeu";
  return `${customerName.split(" ")[0]} enviou uma mensagem`;
}

function RecentActivity() {
  const { conversations, allCustomers } = useDataset();
  const activity: Activity[] = conversations
    .flatMap((c) => c.timeline.map((item) => ({ item, conversation: c })))
    .sort((a, b) => Date.parse(b.item.at) - Date.parse(a.item.at))
    .slice(0, 8);
  return (
    <Panel title="Atividade recente" bodyClassName="p-0" actions={<DemoBadge />}>
      <DataGate skeleton={<ListSkeleton rows={5} />}>
        {activity.length === 0 ? (
          <EmptyState compact icon={Inbox} title="Sem atividade ainda" description="Respostas da IA, encaminhamentos e ações da equipe aparecerão aqui." />
        ) : (
          <ol className="divide-y divide-line">
            {activity.map((a) => {
              const customer = allCustomers.find((c) => c.id === a.conversation.customerId);
              const isAi = (a.item.type === "message" && a.item.author === "ai") || (a.item.type === "event" && /^IA /.test(a.item.text));
              const isCustomer = a.item.type === "message" && a.item.author === "customer";
              const Icon = isAi ? Bot : isCustomer ? UserRound : UserCheck;
              return (
                <li key={a.item.id}>
                  <Link href={conversationHref(a.conversation)} className="focus-ring flex items-center gap-3 px-4 py-2.5 hover:bg-canvas">
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", isAi ? "bg-primary-50 text-primary-700" : "bg-subtle text-ink-3")}>
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
                      <span className="font-medium text-ink">{activityText(a, customer?.name ?? "Cliente")}</span>
                      <span className="text-ink-3"> · {customer?.name}</span>
                    </p>
                    <span className="shrink-0 text-xs text-ink-3 tabular-nums">{formatListTime(a.item.at)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </DataGate>
    </Panel>
  );
}

export function OverviewPage() {
  const { store } = useDataset();
  const storeName = store === "all" ? "Todas as lojas" : storeById(store)?.name;
  return (
    <PageContainer>
      <PageHeader
        title="Visão geral"
        description={`${organization.name} · ${storeName}`}
        meta={<DemoBadge />}
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/configuracoes">
                <Settings className="size-3.5" aria-hidden />
                Configurações
              </Link>
            </Button>
            <Button asChild size="sm" variant="primary">
              <Link href="/inbox">
                <Inbox className="size-3.5" aria-hidden />
                Abrir conversas
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        <AgentSummary />
        <DataGate skeleton={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>}>
          <Kpis />
        </DataGate>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Exceptions />
          <SetupPanel />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ChannelChart />
          <RecentActivity />
        </div>
      </div>
    </PageContainer>
  );
}
