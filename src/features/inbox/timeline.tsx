"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  BookOpen,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CirclePause,
  Clock3,
  Copy,
  Ellipsis,
  FileText,
  Flag,
  FlaskConical,
  Image as ImageIcon,
  Lock,
  MessageSquareReply,
  Package,
  RotateCcw,
  Scale,
  Search,
  ShoppingBag,
  Tags,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/data";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Tooltip } from "@/components/ui/menu";
import { channelLabels, deliveryLabels } from "@/lib/demo/labels";
import { CURRENT_USER_ID, useDemo } from "@/lib/demo/store";
import type { Attachment, Conversation, DeliveryStatus, EventItem, MessageItem, NoteItem, Source, TimelineItem } from "@/lib/demo/types";
import { dayKey, formatClock, formatDayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const sourceIcons: Record<Source["kind"], LucideIcon> = {
  order: Package,
  knowledge: BookOpen,
  product: ShoppingBag,
  rule: Scale,
};

function SourceList({ sources, onOpenOrder }: { sources: Source[]; onOpenOrder: (id: string) => void }) {
  return (
    <ul className="space-y-1.5">
      {sources.map((s, i) => {
        const Icon = sourceIcons[s.kind];
        const label =
          s.kind === "order" && s.refId ? (
            <button type="button" onClick={() => onOpenOrder(s.refId!)} className="focus-ring rounded font-medium text-primary-700 hover:underline">
              {s.label}
            </button>
          ) : s.kind === "knowledge" && s.refId ? (
            <Link href={`/conhecimento?item=${s.refId}`} className="focus-ring rounded font-medium text-primary-700 hover:underline">
              {s.label}
            </Link>
          ) : (
            <span className="font-medium text-ink">{s.label}</span>
          );
        return (
          <li key={i} className="flex items-start gap-2 text-xs">
            <Icon className="mt-px size-3.5 shrink-0 text-ink-3" aria-hidden />
            <span className="min-w-0 leading-snug">
              {label}
              <span className="text-ink-3"> · {s.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DeliveryIndicator({ status, reason }: { status: DeliveryStatus; reason?: string }) {
  if (status === "demo") {
    return (
      <Tooltip content="Demonstração: a mensagem aparece na tela, mas nada foi enviado ao cliente.">
        <span tabIndex={0} className="focus-ring inline-flex items-center gap-1 rounded text-ink-3">
          <FlaskConical className="size-3" aria-hidden />
          {deliveryLabels.demo}
        </span>
      </Tooltip>
    );
  }
  const icons: Record<Exclude<DeliveryStatus, "demo">, LucideIcon> = {
    enviando: Clock3,
    enviada: Check,
    entregue: CheckCheck,
    lida: CheckCheck,
    falhou: CircleAlert,
  };
  const Icon = icons[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        status === "lida" && "text-primary-600",
        status === "falhou" && "font-medium text-danger-700",
      )}
      title={reason}
    >
      <Icon className="size-3.5" aria-hidden />
      {deliveryLabels[status]}
    </span>
  );
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.kind === "image" ? ImageIcon : FileText;
  return (
    <button
      type="button"
      onClick={() =>
        toast.info("Pré-visualização indisponível", {
          description: `“${attachment.name}” é um anexo fictício. Nenhum arquivo foi recebido ou armazenado.`,
        })
      }
      className="focus-ring flex w-full max-w-64 items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-2 text-left hover:bg-canvas"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded bg-subtle text-ink-3">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink">{attachment.name}</span>
        <span className="block text-xs text-ink-3">
          {attachment.kind === "image" ? "Imagem" : attachment.kind === "pdf" ? "PDF" : "Arquivo"} · {attachment.size}
        </span>
      </span>
    </button>
  );
}

function MessageBubble({
  message,
  conversation,
  onOpenOrder,
  onComplement,
}: {
  message: MessageItem;
  conversation: Conversation;
  onOpenOrder: (id: string) => void;
  onComplement: (message: MessageItem) => void;
}) {
  const { state, actions } = useDemo();
  const [showSources, setShowSources] = useState(false);
  const isCustomer = message.author === "customer";
  const isAi = message.author === "ai";
  const member = message.authorId ? state.members.find((m) => m.id === message.authorId) : undefined;
  const customerName = state.customers.find((c) => c.id === conversation.customerId)?.name ?? "Cliente";
  const approver = message.approvedBy ? state.members.find((m) => m.id === message.approvedBy) : undefined;

  const author = isCustomer
    ? customerName
    : isAi
      ? `Agente de IA · ${state.agent.name}`
      : message.authorId === CURRENT_USER_ID
        ? "Você"
        : (member?.name ?? "Equipe");

  return (
    <div className={cn("flex gap-2.5", isCustomer ? "justify-start" : "flex-row-reverse")}>
      <div className="mt-5 shrink-0">
        {isAi ? (
          <span className="flex size-7 items-center justify-center rounded-full bg-primary-600 text-white" aria-hidden>
            <Bot className="size-4" />
          </span>
        ) : (
          <Avatar name={isCustomer ? customerName : (member?.name ?? "Equipe")} size="md" className="size-7" />
        )}
      </div>
      <div className={cn("flex min-w-0 max-w-[88%] flex-col sm:max-w-[76%]", isCustomer ? "items-start" : "items-end")}>
        <div className={cn("mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs", isCustomer ? "" : "justify-end")}>
          <span className={cn("font-medium", isAi ? "text-primary-700" : "text-ink-2")}>{author}</span>
          {isAi && !message.approvedBy && <span className="text-ink-3">· resposta automática</span>}
          {isAi && approver && (
            <span className="text-ink-3">· aprovada por {approver.id === CURRENT_USER_ID ? "você" : approver.name}</span>
          )}
          {message.channel && <span className="text-ink-3">· via {channelLabels[message.channel]}</span>}
          <time className="text-ink-4 tabular-nums" dateTime={message.at}>
            {formatClock(message.at)}
          </time>
        </div>
        <div
          className={cn(
            "relative rounded-2xl border px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-line text-ink",
            isCustomer && "rounded-tl-sm border-line bg-surface",
            isAi && "rounded-tr-sm border-primary-200 bg-primary-50",
            !isCustomer && !isAi && "rounded-tr-sm border-line bg-subtle",
            message.flagged && "ring-2 ring-warning-200",
          )}
        >
          {message.body}
          {message.attachments && (
            <div className="mt-2 space-y-1.5 whitespace-normal">
              {message.attachments.map((a) => (
                <AttachmentCard key={a.name} attachment={a} />
              ))}
            </div>
          )}
          {isAi && message.sources && message.sources.length > 0 && (
            <div className="mt-2 border-t border-primary-200/70 pt-1.5 whitespace-normal">
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                aria-expanded={showSources}
                className="focus-ring inline-flex items-center gap-1 rounded text-xs font-medium text-primary-700 hover:underline"
              >
                <Search className="size-3" aria-hidden />
                {message.sources.length === 1 ? "1 fonte consultada" : `${message.sources.length} fontes consultadas`}
              </button>
              {showSources && (
                <div className="mt-2">
                  <SourceList sources={message.sources} onOpenOrder={onOpenOrder} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3", isCustomer ? "" : "justify-end")}>
          {message.flagged && (
            <Badge tone="warning" icon={<Flag aria-hidden />}>
              Sinalizada como incorreta
            </Badge>
          )}
          {message.delivery && !isCustomer && <DeliveryIndicator status={message.delivery} reason={message.failureReason} />}
          {message.delivery === "falhou" && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => toast.info("Reenvio indisponível", { description: "Não há canal real conectado nesta demonstração." })}
            >
              <RotateCcw className="size-3" aria-hidden />
              Tentar novamente
            </Button>
          )}
          {isAi && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-xs" variant="ghost" className="size-6" aria-label="Ações da resposta da IA">
                  <Ellipsis className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onSelect={() => onComplement(message)}>
                  <MessageSquareReply aria-hidden />
                  Corrigir ou complementar
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={message.flagged}
                  onSelect={() => {
                    actions.flagAiMessage(conversation.id, message.id);
                    toast.success("Resposta sinalizada", {
                      description: "Fica registrada para revisão da configuração do agente (somente nesta sessão).",
                    });
                  }}
                >
                  <Flag aria-hidden />
                  {message.flagged ? "Já sinalizada como incorreta" : "Sinalizar como incorreta"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard?.writeText(message.body).catch(() => undefined);
                    toast.success("Texto copiado");
                  }}
                >
                  <Copy aria-hidden />
                  Copiar texto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note }: { note: NoteItem }) {
  const { state } = useDemo();
  const member = state.members.find((m) => m.id === note.authorId);
  const name = note.authorId === CURRENT_USER_ID ? "Você" : (member?.name ?? "Equipe");
  return (
    <div className="flex flex-row-reverse gap-2.5">
      <div className="mt-5 shrink-0">
        <Avatar name={member?.name ?? "Equipe"} className="size-7" />
      </div>
      <div className="flex max-w-[88%] min-w-0 flex-col items-end sm:max-w-[76%]">
        <div className="mb-1 flex items-center gap-1.5 text-xs">
          <span className="font-medium text-ink-2">{name}</span>
          <time className="text-ink-4 tabular-nums" dateTime={note.at}>
            {formatClock(note.at)}
          </time>
        </div>
        <div className="rounded-2xl rounded-tr-sm border border-dashed border-note-200 bg-note-50 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-[11.5px] font-medium text-note-700">
            <Lock className="size-3" aria-hidden />
            Nota interna · visível só para a equipe
          </p>
          <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-ink">{note.body}</p>
        </div>
      </div>
    </div>
  );
}

const eventIcons: Record<EventItem["kind"], LucideIcon> = {
  classified: Tags,
  lookup: Search,
  handoff: ArrowRightLeft,
  assigned: UserCheck,
  transferred: ArrowRightLeft,
  paused: CirclePause,
  returned_to_ai: Bot,
  resolved: CircleCheck,
  reopened: RotateCcw,
  error: CircleAlert,
  draft: Bot,
};

function EventRow({ event, conversation, onOpenOrder }: { event: EventItem; conversation: Conversation; onOpenOrder: (id: string) => void }) {
  const Icon = eventIcons[event.kind];
  const emphasis = event.kind === "handoff" || event.kind === "error";
  const orderMatch = event.kind === "lookup" ? conversation.orderIds.find((id) => event.text.includes(id)) : undefined;
  return (
    <div className="flex justify-center px-2">
      <div
        className={cn(
          "flex max-w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-xs",
          event.kind === "handoff" && "bg-warning-50/70",
          event.kind === "error" && "bg-danger-50/70",
          !emphasis && "text-ink-3",
        )}
      >
        <Icon
          className={cn(
            "mt-px size-3.5 shrink-0",
            event.kind === "handoff" && "text-warning-700",
            event.kind === "error" && "text-danger-700",
            (event.kind === "lookup" || event.kind === "classified" || event.kind === "draft" || event.kind === "returned_to_ai") && "text-primary-600",
          )}
          aria-hidden
        />
        <p className="min-w-0 leading-snug">
          <span className={cn("font-medium", emphasis ? "text-ink" : "text-ink-2")}>{event.text}</span>
          {event.detail && <span className={emphasis ? "text-ink-2" : "text-ink-3"}> · {event.detail}</span>}
          {orderMatch && (
            <>
              {" "}
              <button type="button" onClick={() => onOpenOrder(orderMatch)} className="focus-ring rounded font-medium text-primary-700 hover:underline">
                Ver pedido
              </button>
            </>
          )}
          <time className="ml-1.5 text-ink-4 tabular-nums" dateTime={event.at}>
            {formatClock(event.at)}
          </time>
        </p>
      </div>
    </div>
  );
}

/** Consultas e classificação da IA: úteis para auditar, ruidosas no dia a dia. */
const EXECUTION_KINDS: EventItem["kind"][] = ["classified", "lookup", "draft"];

type Block = { type: "item"; item: TimelineItem } | { type: "execution"; events: EventItem[] };

function toBlocks(items: TimelineItem[]): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    const last = blocks.at(-1);
    if (item.type === "event" && EXECUTION_KINDS.includes(item.kind)) {
      if (last?.type === "execution" && dayKey(last.events[0].at) === dayKey(item.at)) last.events.push(item);
      else blocks.push({ type: "execution", events: [item] });
    } else {
      blocks.push({ type: "item", item });
    }
  }
  return blocks;
}

function blockAt(block: Block): string {
  return block.type === "item" ? block.item.at : block.events[0].at;
}

function ExecutionDetails({ events, conversation, onOpenOrder }: { events: EventItem[]; conversation: Conversation; onOpenOrder: (id: string) => void }) {
  const lookups = events.filter((e) => e.kind === "lookup").length;
  const summary = lookups
    ? `IA consultou ${lookups === 1 ? "1 fonte" : `${lookups} fontes`}`
    : events.some((e) => e.kind === "draft")
      ? "IA preparou um rascunho"
      : "IA classificou o contato";
  return (
    <details className="group">
      <summary className="focus-ring mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-3 hover:bg-subtle hover:text-ink-2 [&::-webkit-details-marker]:hidden">
        <Bot className="size-3.5 text-primary-600" aria-hidden />
        {summary}
        <span className="text-ink-4">· detalhes da execução</span>
        <ChevronDown className="size-3 text-ink-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-1 space-y-1">
        {events.map((e) => (
          <EventRow key={e.id} event={e} conversation={conversation} onOpenOrder={onOpenOrder} />
        ))}
      </div>
    </details>
  );
}

export function Timeline({
  conversation,
  onOpenOrder,
  onComplement,
}: {
  conversation: Conversation;
  onOpenOrder: (id: string) => void;
  onComplement: (message: MessageItem) => void;
}) {
  const blocks = toBlocks(conversation.timeline);
  return (
    <ol className="space-y-4" aria-label="Histórico da conversa">
      {blocks.map((block, index) => {
        const previous = blocks[index - 1];
        const separator = !previous || dayKey(blockAt(previous)) !== dayKey(blockAt(block));
        const key = block.type === "item" ? block.item.id : `exec-${block.events[0].id}`;
        return (
          <Fragment key={key}>
            {separator && (
              <li className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs font-medium text-ink-3">{formatDayLabel(blockAt(block))}</span>
                <span className="h-px flex-1 bg-line" />
              </li>
            )}
            <li>
              {block.type === "execution" && <ExecutionDetails events={block.events} conversation={conversation} onOpenOrder={onOpenOrder} />}
              {block.type === "item" && block.item.type === "message" && (
                <MessageBubble message={block.item} conversation={conversation} onOpenOrder={onOpenOrder} onComplement={onComplement} />
              )}
              {block.type === "item" && block.item.type === "note" && <NoteCard note={block.item} />}
              {block.type === "item" && block.item.type === "event" && (
                <EventRow event={block.item} conversation={conversation} onOpenOrder={onOpenOrder} />
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
