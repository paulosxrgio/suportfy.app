"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Building2,
  Check,
  ChevronsUpDown,
  CircleUser,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Store as StoreIcon,
} from "lucide-react";
import { toast } from "sonner";
import { StoreDot } from "@/components/shared/domain";
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
import { organization } from "@/lib/demo/data";
import { roleMeta } from "@/lib/demo/labels";
import { CURRENT_USER_ID, stores, useDataset, useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ConversationNav } from "./conversation-nav";
import { isActivePath, navItems } from "./nav-config";

const triggerBase =
  "focus-ring flex w-full items-center gap-2 rounded-md text-left transition-colors hover:bg-subtle data-[state=open]:bg-subtle";

function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const trigger = (
    <DropdownMenuTrigger className={cn(triggerBase, collapsed ? "size-9 justify-center" : "px-2 py-1.5")} aria-label={`Organização: ${organization.name}`}>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-ink text-[10.5px] font-semibold text-white">GH</span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{organization.name}</span>
            <span className="block truncate text-[11.5px] text-ink-3">Organização · {organization.plan}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-ink-4" aria-hidden />
        </>
      )}
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu>
      {collapsed ? <Tooltip content={organization.name} side="right">{trigger}</Tooltip> : trigger}
      <DropdownMenuContent className="w-64" side={collapsed ? "right" : "bottom"}>
        <DropdownMenuLabel>Organizações</DropdownMenuLabel>
        <DropdownMenuItem>
          <Building2 aria-hidden />
          <span className="flex-1">{organization.name}</span>
          <Check className="text-primary-700!" aria-label="Selecionada" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            toast.info("Criação de organizações indisponível", {
              description: "A gestão de organizações depende da autenticação, que ainda não foi implementada.",
            })
          }
        >
          <Plus aria-hidden />
          Criar organização
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes/organizacao">
            <Settings aria-hidden />
            Configurações da organização
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StoreSwitcher({ collapsed }: { collapsed: boolean }) {
  const { state, actions } = useDemo();
  const current = stores.find((s) => s.id === state.store);
  const label = current ? current.name : "Todas as lojas";
  const trigger = (
    <DropdownMenuTrigger
      className={cn(triggerBase, "border border-line bg-surface", collapsed ? "size-9 justify-center" : "h-9 px-2.5")}
      aria-label={`Loja selecionada: ${label}. Alterar loja`}
    >
      {current ? (
        <StoreDot storeId={current.id} className="size-2.5" />
      ) : (
        <StoreIcon className="size-4 shrink-0 text-ink-3" aria-hidden />
      )}
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{label}</span>
          <ChevronsUpDown className="size-3.5 text-ink-4" aria-hidden />
        </>
      )}
    </DropdownMenuTrigger>
  );
  return (
    <DropdownMenu>
      {collapsed ? <Tooltip content={`Loja: ${label}`} side="right">{trigger}</Tooltip> : trigger}
      <DropdownMenuContent className="w-60" side={collapsed ? "right" : "bottom"}>
        <DropdownMenuLabel>Filtrar por loja</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={state.store} onValueChange={(v) => actions.setStore(v)}>
          <DropdownMenuRadioItem value="all">
            <span className="flex-1">Todas as lojas</span>
            <span className="text-xs text-ink-4">{stores.length}</span>
          </DropdownMenuRadioItem>
          {stores.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              <StoreDot storeId={s.id} />
              {s.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracoes/lojas">
            <Settings aria-hidden />
            Gerenciar lojas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AgentStatus({ collapsed }: { collapsed: boolean }) {
  const { agent } = useDataset();
  const channels = Object.values(agent.channels).flatMap((c) => Object.values(c));
  const auto = channels.filter((c) => c.mode === "auto" && !c.paused).length;
  const copilot = channels.filter((c) => c.mode === "copilot" && !c.paused).length;
  const label = agent.orgPaused ? "Pausado na organização" : `Automático em ${auto} de ${channels.length} canais`;
  const detail = copilot > 0 && !agent.orgPaused ? `${label}; copiloto em ${copilot}` : label;
  const content = (
    <Link
      href="/agente"
      className={cn(
        "focus-ring flex items-center gap-2 rounded-md border border-line bg-surface transition-colors hover:border-line-strong",
        collapsed ? "size-9 justify-center" : "px-2.5 py-2",
      )}
      aria-label={`Agente de IA: ${detail} (configuração demonstrativa)`}
    >
      <span className="relative">
        <Bot className="size-4 text-primary-700" aria-hidden />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-surface",
            agent.orgPaused ? "bg-ink-4" : "bg-primary-500",
          )}
          aria-hidden
        />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-ink">Agente de IA</span>
          <span className="block truncate text-[11.5px] text-ink-3">{label}</span>
        </span>
      )}
    </Link>
  );
  return <Tooltip content={`${detail}. Configuração demonstrativa.`} side="right">{content}</Tooltip>;
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { state } = useDemo();
  const me = state.members.find((m) => m.id === CURRENT_USER_ID)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(triggerBase, collapsed ? "size-9 justify-center" : "px-2 py-1.5")} aria-label={`Conta de ${me.name}`}>
        <Avatar name={me.name} size="sm" />
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-ink">{me.name}</span>
            <span className="block truncate text-[11.5px] text-ink-3">{roleMeta[me.role].label}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" side={collapsed ? "right" : "top"} align="start">
        <DropdownMenuLabel className="normal-case">
          <span className="block text-[13px] font-medium tracking-normal text-ink">{me.name}</span>
          <span className="block text-xs font-normal tracking-normal text-ink-3">{me.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/equipe">
            <CircleUser aria-hidden />
            Meu acesso na equipe
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes/notificacoes">
            <Bell aria-hidden />
            Notificações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <Settings aria-hidden />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            toast.info("Sair não está disponível", {
              description: "Esta versão é uma demonstração sem autenticação. Não há sessão para encerrar.",
            })
          }
        >
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
  showCollapseToggle = false,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}) {
  const pathname = usePathname();
  const { actions } = useDemo();
  const { conversations } = useDataset();
  const reviewCount = conversations.filter((c) => c.state === "needs_review" || c.state === "agent_error").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-12 shrink-0 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        {!collapsed && (
          <Link href="/visao-geral" onClick={onNavigate} className="focus-ring rounded-md" aria-label="Suportfy, ir para a visão geral">
            <Logo />
          </Link>
        )}
        {showCollapseToggle && (
          <Tooltip content={collapsed ? "Expandir menu" : "Recolher menu"} side="right">
            <button
              type="button"
              onClick={() => actions.setSidebarCollapsed(!collapsed)}
              className="focus-ring rounded-md p-1.5 text-ink-3 hover:bg-subtle hover:text-ink"
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </Tooltip>
        )}
      </div>

      <div className={cn("flex shrink-0 flex-col gap-1.5 pb-3", collapsed ? "items-center px-2" : "px-3")}>
        <OrgSwitcher collapsed={collapsed} />
        <StoreSwitcher collapsed={collapsed} />
      </div>

      <nav aria-label="Navegação principal" className={cn("min-h-0 flex-1 overflow-y-auto pb-3 scrollbar-thin", collapsed ? "px-2" : "px-3")}>
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (item.conversations && !collapsed) {
              return <ConversationNav key={item.href} icon={Icon} onNavigate={onNavigate} />;
            }
            const active = isActivePath(pathname, item.href);
            const badge = item.conversations && reviewCount > 0 ? reviewCount : null;
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? `${item.label}${badge ? `, ${badge} para revisar` : ""}` : undefined}
                className={cn(
                  "focus-ring relative flex h-8 items-center gap-2.5 rounded-md text-[13.5px] transition-colors",
                  collapsed ? "w-9 justify-center" : "px-2",
                  active ? "bg-primary-50 font-medium text-primary-800" : "text-ink-2 hover:bg-subtle hover:text-ink",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary-600" : "text-ink-3")} aria-hidden />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {badge !== null && (
                  <span className="absolute top-1 right-1 size-2 rounded-full bg-warning-500 ring-2 ring-surface" aria-hidden />
                )}
              </Link>
            );
            return (
              <li key={item.href}>
                {collapsed ? (
                  <Tooltip content={item.label} side="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("flex shrink-0 flex-col gap-2 border-t border-line py-3", collapsed ? "items-center px-2" : "px-3")}>
        <AgentStatus collapsed={collapsed} />
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
