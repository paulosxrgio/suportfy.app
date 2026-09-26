import {
  BookOpen,
  Bot,
  ChartColumn,
  House,
  MessagesSquare,
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
  /** Item com a árvore de conversas (visões gerais e canais). */
  conversations?: boolean;
}

/** Menu principal, compacto e sem títulos de grupo. */
export const navItems: NavItem[] = [
  { href: "/visao-geral", label: "Visão geral", icon: House },
  { href: "/inbox", label: "Conversas", icon: MessagesSquare, conversations: true },
  { href: "/agente", label: "Agente de IA", icon: Bot },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/pedidos", label: "Pedidos", icon: Package },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/conhecimento", label: "Conhecimento", icon: BookOpen },
  { href: "/automacoes", label: "Automações", icon: Workflow },
  { href: "/relatorios", label: "Relatórios", icon: ChartColumn },
  { href: "/equipe", label: "Equipe", icon: UserCog },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
