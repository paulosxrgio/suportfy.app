import {
  BookOpen,
  Bot,
  ChartColumn,
  House,
  Inbox,
  Mail,
  MessageCircle,
  Package,
  Settings,
  UserCog,
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
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Dois grupos, por tipo de trabalho: o atendimento do dia a dia e a operação
 * do agente e da conta. Sem contadores: números ficam na Visão geral e na Inbox.
 * Tickets não aparece aqui porque são as mesmas conversas da Inbox; a página
 * continua acessível pela conversa e pelo menu da lista.
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
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/pedidos", label: "Pedidos", icon: Package },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/agente", label: "Agente de IA", icon: Bot },
      { href: "/conhecimento", label: "Conhecimento", icon: BookOpen },
      { href: "/automacoes", label: "Automações", icon: Workflow },
      { href: "/relatorios", label: "Relatórios", icon: ChartColumn },
      { href: "/equipe", label: "Equipe", icon: UserCog },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((g) => g.items);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Página atual para o título da barra móvel. Tickets fica fora do menu, mas tem nome. */
export function currentSection(pathname: string): string | undefined {
  if (isActivePath(pathname, "/tickets")) return "Tickets";
  return navItems.find((i) => isActivePath(pathname, i.href))?.label;
}
