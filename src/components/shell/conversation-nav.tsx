"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AtSign,
  ChevronDown,
  CircleCheck,
  CircleDot,
  Hourglass,
  Inbox,
  Layers,
  UserRoundCheck,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ChannelIcon } from "@/components/shared/domain";
import { Tooltip } from "@/components/ui/menu";
import { useViewCounter, type ViewCounts } from "@/features/inbox/use-views";
import { CHANNELS, channelFolders, generalViews, parseInboxPath, sameView, viewPath } from "@/features/inbox/views";
import { channelLabels } from "@/lib/demo/labels";
import type { ChannelFolder, InboxView } from "@/lib/demo/selectors";
import type { Channel } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

const generalIcons: Record<string, LucideIcon> = {
  todas: Inbox,
  mencoes: AtSign,
  participando: UserRoundCheck,
  "nao-atribuidas": UserRoundX,
};

const folderIcons: Record<ChannelFolder, LucideIcon> = {
  todas: Inbox,
  "nao-lidas": CircleDot,
  aguardando: Hourglass,
  resolvidas: CircleCheck,
};

/** Qual contador cada visão mostra: revisão, não lidas, total ou nenhum. */
function badgeFor(view: InboxView, counts: ViewCounts): { value: number; attention: boolean; label: string } | null {
  const isAll = view.kind === "todas" || (view.kind === "canal" && view.folder === "todas");
  if (isAll) return counts.review ? { value: counts.review, attention: true, label: `${counts.review} para revisar` } : null;
  if (view.kind === "canal" && view.folder === "resolvidas") return null;
  if (view.kind === "canal" && view.folder === "nao-lidas") {
    return counts.unread ? { value: counts.unread, attention: false, label: `${counts.unread} não lidas` } : null;
  }
  return counts.total ? { value: counts.total, attention: false, label: `${counts.total} conversas` } : null;
}

function CountBadge({ badge }: { badge: NonNullable<ReturnType<typeof badgeFor>> }) {
  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-[5px] px-1.5 text-[11px] leading-[18px] font-medium tabular-nums",
        badge.attention ? "bg-warning-50 text-warning-700 ring-1 ring-warning-200 ring-inset" : "text-ink-3",
      )}
      aria-label={badge.label}
    >
      {badge.value}
    </span>
  );
}

/** Linha-guia vertical das subárvores. */
function Branch({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul className="mt-0.5 ml-[15px] flex flex-col gap-0.5 border-l border-line pl-1" aria-label={label}>
      {children}
    </ul>
  );
}

function ViewLink({
  view,
  label,
  hint,
  icon: Icon,
  active,
  counts,
  onNavigate,
}: {
  view: InboxView;
  label: string;
  hint: string;
  icon: LucideIcon;
  active: boolean;
  counts: ViewCounts;
  onNavigate?: () => void;
}) {
  const badge = badgeFor(view, counts);
  return (
    <li>
      <Tooltip content={hint} side="right">
        <Link
          href={viewPath(view)}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "focus-ring flex h-7 items-center gap-2 rounded-md px-1.5 text-[13px] transition-colors",
            active
              ? "bg-primary-50 font-medium text-primary-800 ring-1 ring-primary-200 ring-inset"
              : "text-ink-2 hover:bg-subtle hover:text-ink",
          )}
        >
          <Icon className={cn("size-3.5 shrink-0", active ? "text-primary-600" : "text-ink-3")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge && <CountBadge badge={badge} />}
        </Link>
      </Tooltip>
    </li>
  );
}

function ToggleRow({
  open,
  onToggle,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "focus-ring flex w-full items-center gap-2 rounded-md px-2 text-left text-ink-2 transition-colors hover:bg-subtle hover:text-ink",
        className,
      )}
    >
      {children}
      <ChevronDown className={cn("ml-auto size-3.5 shrink-0 text-ink-4 transition-transform", !open && "-rotate-90")} aria-hidden />
    </button>
  );
}

/** Árvore "Conversas" do menu lateral: visões gerais e uma pasta por canal. */
export function ConversationNav({ onNavigate, icon: Icon }: { onNavigate?: () => void; icon: LucideIcon }) {
  const pathname = usePathname();
  const counter = useViewCounter();
  const inInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");
  const current = inInbox ? parseInboxPath(pathname.split("/").slice(2).filter(Boolean))?.view : undefined;
  const [open, setOpen] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [channelOpen, setChannelOpen] = useState<Record<Channel, boolean>>({ whatsapp: true, email: true });
  const isActive = (view: InboxView) => current !== undefined && sameView(current, view);

  return (
    <li>
      <ToggleRow open={open} onToggle={() => setOpen((v) => !v)} className={cn("h-8 text-[13.5px]", inInbox && "font-medium text-ink")}>
        <Icon className={cn("size-4 shrink-0", inInbox ? "text-primary-600" : "text-ink-3")} aria-hidden />
        <span className="flex-1 truncate">Conversas</span>
      </ToggleRow>
      {open && (
        <Branch label="Conversas">
          {generalViews.map((g) => (
            <ViewLink
              key={g.view.kind}
              view={g.view}
              label={g.label}
              hint={g.hint}
              icon={generalIcons[g.view.kind]}
              active={isActive(g.view)}
              counts={counter(g.view)}
              onNavigate={onNavigate}
            />
          ))}
          <li>
            <ToggleRow open={channelsOpen} onToggle={() => setChannelsOpen((v) => !v)} className="h-7 text-[13px]">
              <Layers className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              <span className="flex-1 truncate">Canais</span>
            </ToggleRow>
            {channelsOpen && (
              <Branch label="Canais">
                {CHANNELS.map((channel) => {
                  const expanded = channelOpen[channel];
                  const inChannel = current?.kind === "canal" && current.channel === channel;
                  const all = counter({ kind: "canal", channel, folder: "todas" });
                  return (
                    <li key={channel}>
                      <ToggleRow
                        open={expanded}
                        onToggle={() => setChannelOpen((s) => ({ ...s, [channel]: !s[channel] }))}
                        className={cn("h-7 text-[13px]", inChannel && "font-medium text-ink")}
                      >
                        <ChannelIcon channel={channel} className={inChannel ? "text-primary-600" : "text-ink-3"} />
                        <span className="flex-1 truncate">{channelLabels[channel]}</span>
                        {!expanded && all.review > 0 && (
                          <CountBadge badge={{ value: all.review, attention: true, label: `${all.review} para revisar` }} />
                        )}
                      </ToggleRow>
                      {expanded && (
                        <Branch label={channelLabels[channel]}>
                          {channelFolders.map((f) => {
                            const view: InboxView = { kind: "canal", channel, folder: f.id };
                            return (
                              <ViewLink
                                key={f.id}
                                view={view}
                                label={f.label}
                                hint={f.hint}
                                icon={folderIcons[f.id]}
                                active={isActive(view)}
                                counts={counter(view)}
                                onNavigate={onNavigate}
                              />
                            );
                          })}
                        </Branch>
                      )}
                    </li>
                  );
                })}
              </Branch>
            )}
          </li>
        </Branch>
      )}
    </li>
  );
}
