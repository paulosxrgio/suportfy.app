"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  ChevronDown,
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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NotFoundContent } from "@/components/shared/not-found-content";
import { ChannelIcon, StateBadge, StoreDot, storeById } from "@/components/shared/domain";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/data";
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
import { agentModeMeta, priorityMeta } from "@/lib/demo/labels";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import type { Conversation, MessageItem, Priority } from "@/lib/demo/types";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
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

/** Linha discreta com quem conduz a conversa; o motivo do encaminhamento fica recolhido. */
function SupervisionBanner({ conversation }: { conversation: Conversation }) {
  const { state } = useDemo();
  const agent = state.agent;
  const channelSetting = agent.channels[conversation.storeId]?.[conversation.channel];
  const member = (id?: string) => (id === CURRENT_USER_ID ? "você" : state.members.find((m) => m.id === id)?.name ?? "alguém da equipe");
  const agentOff = agent.orgPaused || channelSetting?.paused || channelSetting?.mode === "off";
  const mode = agentModeMeta[channelSetting?.mode ?? "auto"].short.toLowerCase();

  let icon = <Bot className="size-3.5 text-ink-3" aria-hidden />;
  let text: ReactNode;
  let details: ReactNode = null;
  let tone = "text-ink-3";

  switch (conversation.state) {
    case "needs_review":
      icon = <Flag className="size-3.5 text-warning-700" aria-hidden />;
      tone = "text-warning-700";
      text = conversation.aiDraft ? "Resposta da IA aguardando aprovação (modo copiloto)" : "A IA encaminhou esta conversa para revisão humana";
      details = conversation.handoff && (
        <>
          <p>{conversation.handoff.reason}</p>
          <p className="mt-1 text-ink-3">
            Regra aplicada: {conversation.handoff.rule} · às {formatClock(conversation.handoff.at)}
          </p>
          {conversation.aiSuggestion && (
            <p className="mt-2">
              <span className="font-medium text-ink">Sugestão do agente (não executada): </span>
              {conversation.aiSuggestion}
            </p>
          )}
        </>
      );
      break;
    case "agent_error":
      icon = <CircleAlert className="size-3.5 text-danger-700" aria-hidden />;
      tone = "text-danger-700";
      text = "O agente não conseguiu responder";
      details = (
        <>
          <p>{conversation.error}</p>
          {conversation.aiSuggestion && <p className="mt-1.5">{conversation.aiSuggestion}</p>}
        </>
      );
      break;
    case "agent_paused":
      icon = <CirclePause className="size-3.5 text-warning-700" aria-hidden />;
      tone = "text-warning-700";
      text = `IA pausada por ${member(conversation.pausedBy)}. Ninguém assumiu ainda.`;
      break;
    case "human_assigned":
      icon = <UserRound className="size-3.5 text-ink-3" aria-hidden />;
      text = `Conduzida por ${member(conversation.assigneeId ?? undefined)} · IA pausada nesta conversa`;
      details = conversation.handoff && <p>Motivo do encaminhamento: {conversation.handoff.reason}</p>;
      break;
    case "auto_resolved":
      text = "Resolvida pelo agente de IA";
      break;
    case "resolved":
      icon = <CircleCheck className="size-3.5 text-ink-3" aria-hidden />;
      text = "Resolvida pela equipe";
      break;
    default:
      if (agentOff) {
        icon = <CirclePause className="size-3.5 text-warning-700" aria-hidden />;
        text = "Agente pausado neste canal. Novas mensagens aguardam a equipe.";
      } else {
        text =
          conversation.state === "awaiting_customer"
            ? `IA respondeu e aguarda o cliente · modo ${mode}`
            : conversation.state === "awaiting_order_info"
              ? `IA pediu dados para localizar o pedido · modo ${mode}`
              : `IA conduzindo · modo ${mode}`;
      }
  }

  // Intervenção humana e erro ganham uma faixa clara; o resto fica discreto.
  const attention = conversation.state === "needs_review" || conversation.state === "agent_paused";
  const critical = conversation.state === "agent_error";
  const aiAttending = !agentOff && ["ai_active", "awaiting_customer", "awaiting_order_info"].includes(conversation.state);

  const line = (
    <span className={cn("flex min-w-0 items-center gap-1.5", tone)}>
      {icon}
      <span className={cn(attention || critical ? "font-medium" : "truncate")}>{text}</span>
    </span>
  );

  if (attention || critical) {
    const bar = cn(
      "rounded-lg border px-3 py-2 text-[13px]",
      critical ? "border-danger-200 bg-danger-50" : "border-warning-200 bg-warning-50",
    );
    if (!details) return <div className={bar}>{line}</div>;
    return (
      <details className={cn("group", bar)}>
        <summary className="focus-ring -m-1 flex cursor-pointer list-none items-center gap-2 rounded-md p-1 [&::-webkit-details-marker]:hidden">
          {line}
          <span className={cn("ml-auto shrink-0 text-xs", critical ? "text-danger-700" : "text-warning-700")}>
            <span className="group-open:hidden">Ver motivo</span>
            <span className="hidden group-open:inline">Ocultar</span>
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 transition-transform group-open:rotate-180", critical ? "text-danger-700" : "text-warning-700")} aria-hidden />
        </summary>
        <div className={cn("mt-2 border-t pt-2 leading-relaxed text-ink-2", critical ? "border-danger-200" : "border-warning-200")}>{details}</div>
      </details>
    );
  }

  if (aiAttending) {
    return (
      <div className="flex justify-center">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-ai-50 px-2.5 py-1 text-xs text-ai-700">
          <Bot className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{text}</span>
        </span>
      </div>
    );
  }

  if (!details) return <div className="flex justify-center text-xs">{line}</div>;
  return (
    <details className="group text-xs">
      <summary className="focus-ring mx-auto flex w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 hover:bg-subtle [&::-webkit-details-marker]:hidden">
        {line}
        <span className="shrink-0 text-ink-3 group-open:hidden">· ver motivo</span>
        <ChevronDown className="size-3 shrink-0 text-ink-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mx-auto mt-2 max-w-xl rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-ink-2">{details}</div>
    </details>
  );
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
          {!resolved && !mine && (
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
          <div className="min-w-0 grow basis-48">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold text-ink">{customer?.name}</h2>
              <StateBadge state={conversation.state} />
            </div>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
              <ChannelIcon channel={conversation.channel} />
              <StoreDot storeId={conversation.storeId} />
              <span className="truncate">{store?.name}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0 tabular-nums">#{conversation.ticketNumber}</span>
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
