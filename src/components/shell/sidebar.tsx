"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
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
import { CURRENT_USER_ID, stores, useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { isActivePath, navGroups, type NavItem } from "./nav-config";

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

function signOutNotice() {
  toast.info("Sair não está disponível", {
    description: "Esta versão é uma demonstração sem autenticação. Não há sessão para encerrar.",
  });
}

function SignOutButton({ collapsed }: { collapsed: boolean }) {
  const button = (
    <button
      type="button"
      onClick={signOutNotice}
      aria-label={collapsed ? "Sair" : undefined}
      className={cn(
        "focus-ring flex h-8 items-center gap-2.5 rounded-md text-[13.5px] text-ink-2 transition-colors hover:bg-subtle hover:text-ink",
        collapsed ? "w-9 justify-center" : "w-full px-2",
      )}
    >
      <LogOut className="size-4 shrink-0 text-ink-3" aria-hidden />
      {!collapsed && "Sair"}
    </button>
  );
  return collapsed ? (
    <Tooltip content="Sair" side="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
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
            Minha conta e acesso
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Um item ativo por vez: dentro da Inbox, o canal aberto fica marcado e o item
 * "Inbox" só fica marcado na visão com todos os canais.
 */
function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.children) return pathname === item.href || (isActivePath(pathname, item.href) && !item.children.some((c) => isActivePath(pathname, c.href)));
  return isActivePath(pathname, item.href);
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  sub = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  sub?: boolean;
}) {
  const active = collapsed && item.children ? isActivePath(pathname, item.href) : isItemActive(pathname, item);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "focus-ring flex items-center gap-2.5 rounded-md transition-colors",
        sub ? "h-7 px-2 text-[13px]" : "h-8 text-[13.5px]",
        !sub && (collapsed ? "w-9 justify-center" : "px-2"),
        active ? "bg-primary-50 font-medium text-primary-800" : "text-ink-2 hover:bg-subtle hover:text-ink",
      )}
    >
      <Icon className={cn("shrink-0", sub ? "size-3.5" : "size-4", active ? "text-primary-600" : "text-ink-3")} aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
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
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && "mt-5")}>
            {collapsed ? (
              gi > 0 && <div className="mx-auto mb-3 h-px w-6 bg-line" aria-hidden />
            ) : (
              <p className="mb-1 px-2 text-[11px] font-medium tracking-wider text-ink-4 uppercase">{group.label}</p>
            )}
            <ul className="flex flex-col gap-0.5" aria-label={group.label}>
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
                  {item.children && !collapsed && (
                    <ul className="mt-0.5 ml-[17px] flex flex-col gap-0.5 border-l border-line pl-2" aria-label={`Canais da ${item.label}`}>
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <NavLink item={child} pathname={pathname} collapsed={false} onNavigate={onNavigate} sub />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("flex shrink-0 flex-col gap-0.5 border-t border-line py-2", collapsed ? "items-center px-2" : "px-3")}>
        <UserMenu collapsed={collapsed} />
        <SignOutButton collapsed={collapsed} />
      </div>
    </div>
  );
}
