"use client";

import {
  ArrowUp,
  Bot,
  ChevronsUp,
  CircleAlert,
  CirclePause,
  Clock3,
  Mail,
  MessageCircle,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/menu";
import { stores } from "@/lib/demo/data";
import { channelLabels, conversationStateMeta, priorityMeta } from "@/lib/demo/labels";
import { slaInfo } from "@/lib/demo/selectors";
import { useDemo } from "@/lib/demo/store";
import type { Channel, Conversation, ConversationState, Priority } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

export function storeById(id: string) {
  return stores.find((s) => s.id === id);
}

export function StoreDot({ storeId, className }: { storeId: string; className?: string }) {
  const store = storeById(storeId);
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: store?.color ?? "#959ca5" }}
      aria-hidden
    />
  );
}

export function StoreLabel({ storeId, className }: { storeId: string; className?: string }) {
  const store = storeById(storeId);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <StoreDot storeId={storeId} />
      <span className="truncate">{store?.name ?? "Loja"}</span>
    </span>
  );
}

const channelIcons: Record<Channel, LucideIcon> = { whatsapp: MessageCircle, email: Mail };

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const Icon = channelIcons[channel];
  return <Icon className={cn("size-3.5 shrink-0", className)} aria-label={channelLabels[channel]} />;
}

export function ChannelLabel({ channel, className }: { channel: Channel; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <ChannelIcon channel={channel} className="text-ink-3" />
      {channelLabels[channel]}
    </span>
  );
}

const stateIcons: Partial<Record<ConversationState, LucideIcon>> = {
  ai_active: Bot,
  agent_paused: CirclePause,
  agent_error: CircleAlert,
};

export function StateBadge({ state, size = "sm", className }: { state: ConversationState; size?: "sm" | "md"; className?: string }) {
  const meta = conversationStateMeta[state];
  const Icon = stateIcons[state];
  return (
    <Badge tone={meta.tone} size={size} dot={!Icon} icon={Icon ? <Icon aria-hidden /> : undefined} className={className} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === "urgente") {
    return (
      <Tooltip content="Prioridade urgente">
        <span className={cn("inline-flex text-danger-700", className)} role="img" aria-label="Prioridade urgente">
          <ChevronsUp className="size-3.5" />
        </span>
      </Tooltip>
    );
  }
  if (priority === "alta") {
    return (
      <Tooltip content="Prioridade alta">
        <span className={cn("inline-flex text-warning-700", className)} role="img" aria-label="Prioridade alta">
          <ArrowUp className="size-3.5" />
        </span>
      </Tooltip>
    );
  }
  return null;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = priorityMeta[priority];
  if (priority === "normal" || priority === "baixa") {
    return <span className="text-[13px] text-ink-3">{meta.label}</span>;
  }
  return (
    <Badge tone={meta.tone} icon={priority === "urgente" ? <ChevronsUp aria-hidden /> : <ArrowUp aria-hidden />}>
      {meta.label}
    </Badge>
  );
}

export function SlaIndicator({ conversation, variant = "compact" }: { conversation: Conversation; variant?: "compact" | "full" }) {
  const sla = slaInfo(conversation);
  if (sla.status === "nenhum" || sla.status === "cumprido") {
    return variant === "full" ? <span className="text-[13px] text-ink-3">{sla.label}</span> : null;
  }
  const styles: Record<string, string> = {
    ok: "text-ink-3",
    risco: "text-warning-700",
    vencido: "text-danger-700",
    pausado: "text-ink-4",
  };
  const Icon = sla.status === "pausado" ? TimerOff : Clock3;
  return (
    <Tooltip content={sla.label}>
      <span
        tabIndex={variant === "full" ? 0 : -1}
        className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums", styles[sla.status])}
        aria-label={sla.label}
      >
        <Icon className="size-3.5" aria-hidden />
        {variant === "full" ? sla.label : sla.short}
      </span>
    </Tooltip>
  );
}

/** Quem conduz a conversa: o agente de IA, uma pessoa ou ninguém. */
export function AssigneeLabel({ conversation, showName = true }: { conversation: Conversation; showName?: boolean }) {
  const { state } = useDemo();
  const member = conversation.assigneeId ? state.members.find((m) => m.id === conversation.assigneeId) : undefined;
  if (member) {
    const label = (
      <span className="inline-flex min-w-0 items-center gap-1.5" aria-label={showName ? undefined : `Responsável: ${member.name}`}>
        <Avatar name={member.name} size="xs" />
        {showName && <span className="truncate">{member.name}</span>}
      </span>
    );
    return showName ? label : <Tooltip content={`Responsável: ${member.name}`}>{label}</Tooltip>;
  }
  const aiHandled = ["ai_active", "awaiting_customer", "awaiting_order_info", "auto_resolved"].includes(conversation.state);
  if (aiHandled) {
    const label = (
      <span className="inline-flex items-center gap-1.5 text-primary-700" aria-label={showName ? undefined : "Conduzida pelo agente de IA"}>
        <span className="flex size-5 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-200">
          <Bot className="size-3" aria-hidden />
        </span>
        {showName && <span>Agente de IA</span>}
      </span>
    );
    return showName ? label : <Tooltip content="Conduzida pelo agente de IA">{label}</Tooltip>;
  }
  const unassigned = (
    <span className="inline-flex items-center gap-1.5 text-ink-3" aria-label={showName ? undefined : "Sem responsável"}>
      <span className="size-5 rounded-full border border-dashed border-line-strong" aria-hidden />
      {showName && <span>Sem responsável</span>}
    </span>
  );
  return showName ? unassigned : <Tooltip content="Sem responsável">{unassigned}</Tooltip>;
}

export function TagChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  const { state } = useDemo();
  const color = state.tags.find((t) => t.name === name)?.color ?? "#959ca5";
  return (
    <span className="inline-flex h-5 max-w-full items-center gap-1 rounded-[5px] border border-line bg-surface px-1.5 text-[11.5px] text-ink-2">
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="focus-ring -mr-0.5 rounded text-ink-4 hover:text-ink"
          aria-label={`Remover tag ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export type IntegrationState = "nao_configurado" | "configuracao_necessaria" | "validando" | "conectado" | "erro";

export const integrationStateMeta: Record<IntegrationState, { label: string; tone: "neutral" | "warning" | "primary" | "success" | "danger" }> = {
  nao_configurado: { label: "Não conectado", tone: "neutral" },
  configuracao_necessaria: { label: "Configuração necessária", tone: "warning" },
  validando: { label: "Validando", tone: "primary" },
  conectado: { label: "Conectado", tone: "success" },
  erro: { label: "Erro", tone: "danger" },
};

export function IntegrationBadge({
  state,
  demo,
  labels,
}: {
  state: IntegrationState;
  demo?: boolean;
  labels?: Partial<Record<IntegrationState, string>>;
}) {
  const meta = integrationStateMeta[state];
  return (
    <Badge tone={meta.tone} dot>
      {labels?.[state] ?? meta.label}
      {demo ? " (prévia)" : ""}
    </Badge>
  );
}
