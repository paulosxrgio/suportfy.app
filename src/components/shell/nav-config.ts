import {
  BookOpen,
  Bot,
  ChartColumn,
  House,
  Inbox,
  Mail,
  MessageCircle,
  Settings,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Subitens sempre visíveis (somente os canais da Inbox). */
  children?: NavItem[];
  /** Rotas fora do menu que ficam sob este item (marcam o item como ativo). */
  related?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Dois grupos, por tipo de trabalho: o atendimento do dia a dia e a operação
 * do agente e da conta. Sem contadores: números ficam na Visão geral e na Inbox.
 * Fora do menu, com acesso por contexto:
 * - Tickets: as mesmas conversas da Inbox (conversa e menu da lista);
 * - Pedidos: consultados na conversa e no cliente (página completa a partir de Clientes);
 * - Equipe: administração de pessoas, dentro de Configurações.
 */
export const navGroups: NavGroup[] = [
  {
    label: "Atendimento",
    items: [
      { href: "/visao-geral", label: "Visão geral", icon: House },
      {
        href: "/inbox",
        label: "Inbox",
        icon: Inbox,
        children: [
          { href: "/inbox/whatsapp", label: "WhatsApp", icon: MessageCircle },
          { href: "/inbox/email", label: "E-mail", icon: Mail },
        ],
      },
      { href: "/clientes", label: "Clientes", icon: Users, related: ["/pedidos"] },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/agente", label: "Agente de IA", icon: Bot },
      { href: "/conhecimento", label: "Conhecimento", icon: BookOpen },
      { href: "/automacoes", label: "Automações", icon: Workflow },
      { href: "/relatorios", label: "Relatórios", icon: ChartColumn },
      { href: "/configuracoes", label: "Configurações", icon: Settings, related: ["/equipe"] },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const offMenuTitles: Record<string, string> = { "/tickets": "Tickets", "/pedidos": "Pedidos", "/equipe": "Equipe" };

/** Página atual para o título da barra móvel, inclusive as que ficam fora do menu. */
export function currentSection(pathname: string): string | undefined {
  const offMenu = Object.keys(offMenuTitles).find((href) => isActivePath(pathname, href));
  if (offMenu) return offMenuTitles[offMenu];
  return navItems.find((i) => isActivePath(pathname, i.href))?.label;
}
