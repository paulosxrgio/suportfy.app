"use client";

import type { ComponentType } from "react";
import { NotFoundContent } from "@/components/shared/not-found-content";
import { AuditSection, CostsSection, HoursSection, NotificationsSection, OrganizationSection, SecuritySection, StoresSection } from "./sections/general";
import { AiSection, ApiSection, EmailSection, ShopifySection, WebhooksSection, WhatsAppSection } from "./sections/integrations";
import {
  AgentSettingsSection,
  AutomationsSettingsSection,
  KnowledgeSettingsSection,
  QuickRepliesSection,
  SlaSection,
  TagsSection,
  TeamSettingsSection,
  TemplatesSection,
} from "./sections/service";

const sectionComponents: Record<string, ComponentType> = {
  organizacao: OrganizationSection,
  lojas: StoresSection,
  horarios: HoursSection,
  notificacoes: NotificationsSection,
  shopify: ShopifySection,
  whatsapp: WhatsAppSection,
  email: EmailSection,
  "inteligencia-artificial": AiSection,
  webhooks: WebhooksSection,
  api: ApiSection,
  "agente-ia": AgentSettingsSection,
  conhecimento: KnowledgeSettingsSection,
  automacoes: AutomationsSettingsSection,
  "equipe-permissoes": TeamSettingsSection,
  sla: SlaSection,
  tags: TagsSection,
  "respostas-rapidas": QuickRepliesSection,
  templates: TemplatesSection,
  seguranca: SecuritySection,
  auditoria: AuditSection,
  custos: CostsSection,
};

export function SettingsSectionView({ slug }: { slug: string }) {
  const Component = sectionComponents[slug];
  if (!Component) {
    return <NotFoundContent title="Seção não encontrada" description="Escolha uma seção na lista de configurações." href="/configuracoes" cta="Ver configurações" />;
  }
  return <Component />;
}
