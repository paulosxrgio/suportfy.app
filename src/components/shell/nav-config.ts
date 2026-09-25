import {
  BookOpen,
  Bot,
  ChartColumn,
  House,
  Inbox,
  Package,
  Settings,
  Ticket,
  UserCog,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Mostra a contagem de conversas que precisam de revisão. */
  reviewBadge?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/visao-geral", label: "Visão geral", icon: House },
      { href: "/inbox", label: "Inbox", icon: Inbox, reviewBadge: true },
    ],
  },
  {
    label: "Atendimento",
    items: [
      { href: "/tickets", label: "Tickets", icon: Ticket },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/pedidos", label: "Pedidos", icon: Package },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/agente", label: "Agente de IA", icon: Bot },
      { href: "/conhecimento", label: "Conhecimento", icon: BookOpen },
      { href: "/automacoes", label: "Automações", icon: Workflow },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/relatorios", label: "Relatórios", icon: ChartColumn },
      { href: "/equipe", label: "Equipe", icon: UserCog },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
