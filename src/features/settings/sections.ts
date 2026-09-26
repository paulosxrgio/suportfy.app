import {
  BookOpen,
  Bot,
  Building2,
  Code2,
  FileText,
  History,
  KeyRound,
  Mail,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  Store,
  Tags,
  UserCog,
  Wallet,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface SettingsSection {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface SettingsGroup {
  label: string;
  items: SettingsSection[];
}

export const settingsGroups: SettingsGroup[] = [
  {
    label: "Geral",
    items: [
      { slug: "organizacao", label: "Organização", description: "Nome, dados fiscais, fuso horário e idioma.", icon: Building2 },
      { slug: "lojas", label: "Lojas", description: "Lojas Shopify atendidas pela organização.", icon: Store },
    ],
  },
  {
    label: "Canais e integrações",
    items: [
      { slug: "shopify", label: "Shopify", description: "Pedidos, clientes e produtos de cada loja.", icon: ShoppingBag },
      { slug: "whatsapp", label: "WhatsApp", description: "Números conectados via Evolution API.", icon: MessageCircle },
      { slug: "email", label: "E-mail", description: "Envio via Resend e caixas de entrada.", icon: Mail },
      { slug: "inteligencia-artificial", label: "Inteligência Artificial", description: "Chave da OpenAI, modelo, limites e custos.", icon: KeyRound },
      { slug: "webhooks", label: "Webhooks", description: "Eventos enviados para sistemas externos.", icon: Webhook },
      { slug: "api", label: "API", description: "Chaves de acesso à API do Suportfy.", icon: Code2 },
    ],
  },
  {
    label: "Atendimento",
    items: [
      { slug: "agente-ia", label: "Agente de IA", description: "Políticas globais de dados e privacidade do agente.", icon: Bot },
      { slug: "conhecimento", label: "Conhecimento", description: "Regras de publicação e revisão de conteúdo.", icon: BookOpen },
      { slug: "automacoes", label: "Automações", description: "Limites e permissões das regras.", icon: Workflow },
      { slug: "tags", label: "Tags", description: "Etiquetas usadas pela IA e pela equipe.", icon: Tags },
      { slug: "respostas-rapidas", label: "Respostas rápidas", description: "Textos prontos para intervenções da equipe.", icon: Zap },
      { slug: "templates", label: "Templates", description: "Mensagens padrão para WhatsApp e e-mail.", icon: FileText },
    ],
  },
  {
    label: "Equipe e segurança",
    items: [
      { slug: "equipe-permissoes", label: "Equipe e permissões", description: "Funções padrão e regras de acesso.", icon: UserCog },
      { slug: "seguranca", label: "Segurança", description: "Sessões, domínios e proteção de dados.", icon: ShieldCheck },
      { slug: "auditoria", label: "Auditoria", description: "Registro de ações feitas na organização.", icon: History },
      { slug: "custos", label: "Custos", description: "Plano, consumo de IA e canais.", icon: Wallet },
    ],
  },
];

export const allSettingsSections = settingsGroups.flatMap((g) => g.items);

export function findSection(slug: string) {
  return allSettingsSections.find((s) => s.slug === slug);
}
