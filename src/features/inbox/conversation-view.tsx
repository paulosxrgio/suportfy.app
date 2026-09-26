"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Bot,
  CircleAlert,
  CircleCheck,
  CirclePause,
  Ellipsis,
  Flag,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  Play,
  RotateCcw,
  Ticket,
  UserCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { NotFoundContent } from "@/components/shared/not-found-content";
import { ChannelIcon, StateBadge, StoreDot, storeById } from "@/components/shared/domain";
import { Button } from "@/components/ui/button";
import { Avatar, Callout } from "@/components/ui/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OrderSheet } from "@/features/orders/order-detail";
import { agentModeMeta, channelLabels, priorityMeta } from "@/lib/demo/labels";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import type { Conversation, MessageItem, Priority } from "@/lib/demo/types";
import { formatClock } from "@/lib/format";
import { Composer, type ComposerSeed } from "./composer";
import { CustomerPanel } from "./customer-panel";
import { useInbox } from "./inbox-shell";
import { Timeline } from "./timeline";
import { TransferDialog } from "./transfer-dialog";

function useConversationActions(conversation: Conversation) {
  const { actions } = useDemo();
  const id = conversation.id;
  return {
    assume: () => {
      actions.assume(id);
      toast.success("Você assumiu a conversa", { description: "A IA fica pausada nesta conversa até você devolvê-la." });
    },
    pauseAi: () => {
      actions.pauseAi(id);
      toast.success("IA pausada nesta conversa", { description: "Ela não responde até ser retomada ou devolvida." });
    },
    returnToAi: () => {
      actions.returnToAi(id);
      toast.success("Conversa devolvida ao agente de IA", {
        description: "Demonstração: nenhum agente real vai responder.",
      });
    },
    resolve: () => {
      actions.resolve(id);
      toast.success("Conversa resolvida", {
        description: "Mantido apenas nesta sessão.",
        action: { label: "Reabrir", onClick: () => actions.reopen(id) },
      });
    },
    reopen: () => {
      actions.reopen(id);
      toast.success("Conversa reaberta");
    },
    setPriority: (p: Priority) => {
      actions.setPriority(id, p);
      toast.success(`Prioridade alterada para ${priorityMeta[p].label.toLowerCase()}`);
    },
  };
}

function SupervisionBanner({ conversation }: { conversation: Conversation }) {
  const { state } = useDemo();
  const agent = state.agent;
  const channelSetting = agent.channels[conversation.storeId]?.[conversation.channel];
  const store = storeById(conversation.storeId);
  const where = `${store?.name ?? "Loja"} · ${channelLabels[conversation.channel]}`;
  const member = (id?: string) => (id === CURRENT_USER_ID ? "você" : state.members.find((m) => m.id === id)?.name ?? "alguém da equipe");

  switch (conversation.state) {
    case "needs_review":
      if (conversation.aiDraft) {
        return (
          <Callout tone="info" icon={Bot} title="Resposta da IA aguardando aprovação">
            O agente está em modo copiloto em {where}. Revise a resposta abaixo, edite se precisar e aprove ou descarte.
          </Callout>
        );
      }
      return (
        <Callout tone="warning" icon={Flag} title="Encaminhada para revisão humana">
          <p>{conversation.handoff?.reason}</p>
          {conversation.handoff && (
            <p className="mt-1 text-xs text-ink-3">
              Regra aplicada: {conversation.handoff.rule} · às {formatClock(conversation.handoff.at)}
            </p>
          )}
          {conversation.aiSuggestion && (
            <p className="mt-2 border-t border-warning-200 pt-2">
              <span className="font-medium text-ink">Sugestão do agente (não executada): </span>
              {conversation.aiSuggestion}
            </p>
          )}
        </Callout>
      );
    case "agent_error":
      return (
        <Callout tone="danger" title="O agente não conseguiu responder">
          <p>{conversation.error}</p>
          {conversation.aiSuggestion && <p className="mt-1.5 text-ink-2">{conversation.aiSuggestion}</p>}
        </Callout>
      );
    case "agent_paused":
      return (
        <Callout tone="neutral" icon={CirclePause} title={`IA pausada nesta conversa por ${member(conversation.pausedBy)}`}>
          Ninguém assumiu ainda. Assuma para responder ao cliente ou retome a IA.
        </Callout>
      );
    case "human_assigned":
      return (
        <Callout tone="neutral" icon={UserRound} title={`Conduzida por ${member(conversation.assigneeId ?? undefined)}`}>
          A IA está pausada nesta conversa.
          {conversation.handoff && ` Motivo do encaminhamento: ${conversation.handoff.reason}`}
        </Callout>
      );
    case "auto_resolved":
    case "resolved":
      return null;
    default: {
      if (agent.orgPaused || channelSetting?.paused || channelSetting?.mode === "off") {
        return (
          <Callout tone="warning" icon={CirclePause} title="O agente está pausado para este canal">
            Enquanto estiver pausado em {where}, novas mensagens ficam aguardando a equipe.
          </Callout>
        );
      }
      const stateText =
        conversation.state === "awaiting_customer"
          ? "A IA respondeu e aguarda o retorno do cliente. O SLA fica pausado."
          : conversation.state === "awaiting_order_info"
            ? "A IA pediu dados para localizar o pedido e não informa status sem confirmá-lo."
            : "O agente está conduzindo o atendimento. Você pode acompanhar, pausar ou assumir a qualquer momento.";
      return (
        <div className="flex items-start gap-2 rounded-lg border border-primary-200 bg-primary-50/60 px-3.5 py-2.5 text-[13px] text-ink-2">
          <Bot className="mt-0.5 size-4 shrink-0 text-primary-600" aria-hidden />
          <p>
            <span className="font-medium text-ink">Modo {agentModeMeta[channelSetting?.mode ?? "auto"].short.toLowerCase()}</span> em{" "}
            {where}. {stateText}
          </p>
        </div>
      );
    }
  }
}

function HeaderActions({ conversation, onTransfer }: { conversation: Conversation; onTransfer: () => void }) {
  const a = useConversationActions(conversation);
  const resolved = conversation.state === "resolved" || conversation.state === "auto_resolved";
  const aiConducting = ["ai_active", "awaiting_customer", "awaiting_order_info"].includes(conversation.state);
  const mine = conversation.state === "human_assigned" && conversation.assigneeId === CURRENT_USER_ID;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {resolved && (
        <Button size="sm" onClick={a.reopen}>
          <RotateCcw className="size-3.5" aria-hidden />
          Reabrir
        </Button>
      )}
      {aiConducting && (
        <Button size="sm" onClick={a.pauseAi}>
          <CirclePause className="size-3.5" aria-hidden />
          Pausar IA
        </Button>
      )}
      {(conversation.state === "needs_review" || conversation.state === "agent_error" || conversation.state === "agent_paused" || mine) && (
        <Tooltip content="A IA volta a conduzir a conversa">
          <Button size="sm" onClick={a.returnToAi}>
            {conversation.state === "agent_paused" ? <Play className="size-3.5" aria-hidden /> : <Bot className="size-3.5" aria-hidden />}
            {conversation.state === "agent_paused" ? "Retomar IA" : "Devolver à IA"}
          </Button>
        </Tooltip>
      )}
      {!resolved && !mine && (
        <Button size="sm" variant="primary" onClick={a.assume}>
          <UserCheck className="size-3.5" aria-hidden />
          Assumir
        </Button>
      )}
      {mine && (
        <Button size="sm" variant="primary" onClick={a.resolve}>
          <CircleCheck className="size-3.5" aria-hidden />
          Resolver
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Mais ações da conversa">
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {!resolved && (
            <DropdownMenuItem onSelect={onTransfer}>
              <ArrowRightLeft aria-hidden />
              Transferir…
            </DropdownMenuItem>
          )}
          {!resolved && !mine && (
            <DropdownMenuItem onSelect={a.resolve}>
              <CircleCheck aria-hidden />
              Resolver ou encerrar
            </DropdownMenuItem>
          )}
          {aiConducting && (
            <DropdownMenuItem onSelect={a.assume}>
              <UserCheck aria-hidden />
              Assumir conversa
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Prioridade</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={conversation.priority} onValueChange={(v) => a.setPriority(v as Priority)}>
            {(Object.keys(priorityMeta) as Priority[]).map((p) => (
              <DropdownMenuRadioItem key={p} value={p}>
                {priorityMeta[p].label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/tickets?ticket=${conversation.ticketNumber}`}>
              <Ticket aria-hidden />
              Ver ticket #{conversation.ticketNumber}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/clientes/${conversation.customerId}`}>
              <UserRound aria-hidden />
              Ver perfil do cliente
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ConversationView({ id }: { id: string }) {
  const { state, actions } = useDemo();
  const { listHref } = useInbox();
  const dataset = useDataset();
  const conversation = dataset.conversations.find((c) => c.id === id);
  const hiddenByStore = !conversation && dataset.allConversations.find((c) => c.id === id);
  const customer = conversation ? dataset.allCustomers.find((c) => c.id === conversation.customerId) : undefined;
  const [orderId, setOrderId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [seed, setSeed] = useState<ComposerSeed>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineLength = conversation?.timeline.length ?? 0;
  const { markRead } = actions;

  useEffect(() => {
    markRead(id);
  }, [id, markRead]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [id, timelineLength]);

  if (!conversation) {
    if (hiddenByStore) {
      const store = storeById(hiddenByStore.storeId);
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-ink">Esta conversa é da loja {store?.name}</p>
          <p className="mt-1 max-w-sm text-[13px] text-ink-3">O filtro de loja atual não inclui esta conversa.</p>
          <Button size="sm" className="mt-4" onClick={() => actions.setStore("all")}>
            Ver todas as lojas
          </Button>
        </div>
      );
    }
    return (
      <div className="flex-1">
        <NotFoundContent
          title="Conversa não encontrada"
          description="Ela pode ter sido removida ou não existe nesta demonstração."
          href="/inbox"
          cta="Voltar para a Inbox"
        />
      </div>
    );
  }

  const store = storeById(conversation.storeId);
  const mine = conversation.state === "human_assigned" && conversation.assigneeId === CURRENT_USER_ID;

  const complement = (message: MessageItem) => {
    const text = `Complementando a resposta anterior: `;
    if (mine) {
      setSeed({ mode: "reply", text, nonce: Date.now() });
      return;
    }
    toast.info("Assuma a conversa para responder ao cliente", {
      description: "Enquanto a IA conduz, você pode registrar a correção como nota interna.",
      action: {
        label: "Assumir",
        onClick: () => {
          actions.assume(conversation.id);
          setSeed({ mode: "reply", text, nonce: Date.now() });
        },
      },
    });
    setSeed({ mode: "note", text: `Correção da resposta da IA (${formatClock(message.at)}): `, nonce: Date.now() });
  };

  const panel = <CustomerPanel conversation={conversation} onOpenOrder={setOrderId} />;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`Conversa com ${customer?.name ?? "cliente"}`}>
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-3 py-2.5 sm:px-4">
          <Button asChild size="icon-sm" variant="ghost" className="lg:hidden">
            <Link href={listHref} aria-label="Voltar para a lista de conversas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Avatar name={customer?.name ?? "Cliente"} className="hidden sm:inline-flex" />
          <div className="min-w-0 grow basis-60">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold text-ink">{customer?.name}</h2>
              <StateBadge state={conversation.state} size="md" />
            </div>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
              <ChannelIcon channel={conversation.channel} />
              {channelLabels[conversation.channel]}
              <span aria-hidden>·</span>
              <StoreDot storeId={conversation.storeId} />
              <span className="truncate">{store?.name}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0">#{conversation.ticketNumber}</span>
              <span className="hidden truncate md:inline">· {conversation.subject}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <HeaderActions conversation={conversation} onTransfer={() => setTransferOpen(true)} />
            <Tooltip content="Dados do cliente">
              <Button size="icon-sm" variant="ghost" className="xl:hidden" onClick={() => setPanelOpen(true)} aria-label="Abrir dados do cliente">
                <PanelRight className="size-4" />
              </Button>
            </Tooltip>
            <Tooltip content={state.contactPanelOpen ? "Recolher painel do cliente" : "Mostrar painel do cliente"}>
              <Button
                size="icon-sm"
                variant={state.contactPanelOpen ? "subtle" : "ghost"}
                className="hidden xl:inline-flex"
                onClick={() => actions.setContactPanelOpen(!state.contactPanelOpen)}
                aria-pressed={state.contactPanelOpen}
                aria-label="Painel do cliente e dos pedidos"
              >
                {state.contactPanelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
              </Button>
            </Tooltip>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:px-5">
            <SupervisionBanner conversation={conversation} />
            {conversation.timeline.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-ink-3">
                <CircleAlert className="mx-auto mb-2 size-5 text-ink-4" aria-hidden />
                Nenhuma mensagem nesta conversa.
              </div>
            ) : (
              <Timeline conversation={conversation} onOpenOrder={setOrderId} onComplement={complement} />
            )}
          </div>
        </div>

        <div className="border-t border-line bg-canvas">
          <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-5">
            <Composer
              key={`${conversation.id}-${seed?.nonce ?? 0}`}
              conversation={conversation}
              seed={seed}
              onRequestTransfer={() => setTransferOpen(true)}
            />
          </div>
        </div>
      </section>

      {state.contactPanelOpen && (
        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-line bg-surface scrollbar-thin xl:block" aria-label="Dados do cliente">
          {panel}
        </aside>
      )}

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent title="Dados do cliente" width="w-[min(100vw,380px)]">
          {panel}
        </SheetContent>
      </Sheet>

      <OrderSheet orderId={orderId} onOpenChange={(open) => !open && setOrderId(null)} />
      <TransferDialog conversation={conversation} open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
