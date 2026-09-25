import type {
  AgentMode,
  AutomationResult,
  AutomationState,
  Channel,
  ContactReason,
  ConversationState,
  DeliveryStatus,
  FinancialStatus,
  FulfillmentStatus,
  KnowledgeStatus,
  KnowledgeType,
  MemberStatus,
  OrderStatus,
  Priority,
  Role,
  TicketStatus,
} from "./types";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "note" | "info";

export const channelLabels: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
};

export const conversationStateMeta: Record<ConversationState, { label: string; tone: Tone; description: string }> = {
  ai_active: {
    label: "IA atendendo",
    tone: "primary",
    description: "O agente de IA está conduzindo a conversa.",
  },
  awaiting_customer: {
    label: "Aguardando cliente",
    tone: "neutral",
    description: "A IA respondeu e aguarda o retorno do cliente.",
  },
  awaiting_order_info: {
    label: "Aguardando dados do pedido",
    tone: "neutral",
    description: "A IA pediu informações para localizar o pedido.",
  },
  needs_review: {
    label: "Precisa de revisão",
    tone: "warning",
    description: "A IA encaminhou para uma pessoa revisar.",
  },
  human_assigned: {
    label: "Com a equipe",
    tone: "info",
    description: "Uma pessoa assumiu a conversa; a IA está pausada nela.",
  },
  auto_resolved: {
    label: "Resolvida pela IA",
    tone: "success",
    description: "A IA resolveu sem intervenção humana.",
  },
  resolved: {
    label: "Resolvida",
    tone: "success",
    description: "Resolvida por uma pessoa da equipe.",
  },
  agent_paused: {
    label: "IA pausada",
    tone: "neutral",
    description: "A IA foi pausada nesta conversa e ninguém a assumiu.",
  },
  agent_error: {
    label: "Erro no agente",
    tone: "danger",
    description: "O agente falhou e não respondeu ao cliente.",
  },
};

export const ticketStatusMeta: Record<TicketStatus, { label: string; tone: Tone }> = {
  aberto: { label: "Aberto", tone: "primary" },
  pendente: { label: "Pendente", tone: "neutral" },
  resolvido: { label: "Resolvido", tone: "success" },
};

export const priorityMeta: Record<Priority, { label: string; tone: Tone; rank: number }> = {
  urgente: { label: "Urgente", tone: "danger", rank: 0 },
  alta: { label: "Alta", tone: "warning", rank: 1 },
  normal: { label: "Normal", tone: "neutral", rank: 2 },
  baixa: { label: "Baixa", tone: "neutral", rank: 3 },
};

export const reasonLabels: Record<ContactReason, string> = {
  status_pedido: "Status do pedido",
  rastreamento: "Rastreamento",
  produto_danificado: "Produto danificado ou com defeito",
  troca: "Troca",
  reembolso: "Reembolso",
  cancelamento: "Cancelamento",
  alteracao_endereco: "Alteração de endereço",
  pagamento: "Pagamento",
  duvida_produto: "Dúvida sobre produto",
  cupom: "Cupom e promoções",
  prazo_entrega: "Prazo de entrega",
  nota_fiscal: "Nota fiscal",
  reclamacao: "Reclamação",
};

export const deliveryLabels: Record<DeliveryStatus, string> = {
  enviando: "Enviando",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Falha no envio",
  demo: "Não enviada (demonstração)",
};

export const financialStatusMeta: Record<FinancialStatus, { label: string; tone: Tone }> = {
  pago: { label: "Pago", tone: "success" },
  pendente: { label: "Pendente", tone: "warning" },
  reembolsado: { label: "Reembolsado", tone: "neutral" },
  parcialmente_reembolsado: { label: "Reembolso parcial", tone: "neutral" },
};

export const fulfillmentStatusMeta: Record<FulfillmentStatus, { label: string; tone: Tone }> = {
  nao_enviado: { label: "Não enviado", tone: "neutral" },
  em_transito: { label: "Em trânsito", tone: "info" },
  entregue: { label: "Entregue", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export const orderStatusMeta: Record<OrderStatus, { label: string; tone: Tone }> = {
  aberto: { label: "Aberto", tone: "primary" },
  arquivado: { label: "Arquivado", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "danger" },
};

export const knowledgeStatusMeta: Record<KnowledgeStatus, { label: string; tone: Tone }> = {
  publicado: { label: "Publicado", tone: "success" },
  rascunho: { label: "Rascunho", tone: "warning" },
  arquivado: { label: "Arquivado", tone: "neutral" },
};

export const knowledgeTypeLabels: Record<KnowledgeType, string> = {
  politica: "Política",
  faq: "FAQ",
  documento: "Documento",
};

export const automationStateMeta: Record<AutomationState, { label: string; tone: Tone }> = {
  ativa: { label: "Ativa", tone: "success" },
  pausada: { label: "Pausada", tone: "neutral" },
  rascunho: { label: "Rascunho", tone: "warning" },
};

export const automationResultMeta: Record<AutomationResult, { label: string; tone: Tone }> = {
  sucesso: { label: "Sucesso", tone: "success" },
  falhou: { label: "Falhou", tone: "danger" },
  sem_acao: { label: "Sem ação", tone: "neutral" },
};

export const automationTriggers: { id: string; label: string; description: string }[] = [
  { id: "nova_conversa", label: "Nova conversa", description: "Quando uma conversa é criada em qualquer canal." },
  { id: "mensagem_recebida", label: "Mensagem recebida", description: "A cada nova mensagem do cliente." },
  { id: "ia_classificou", label: "IA classificou o motivo", description: "Quando o agente define ou altera o motivo do contato." },
  { id: "ia_encaminhou", label: "IA encaminhou para revisão", description: "Quando o agente transfere a conversa para uma pessoa." },
  { id: "sla_em_risco", label: "SLA em risco", description: "Quando faltam 30 minutos para o vencimento do SLA." },
  { id: "pedido_atualizado", label: "Pedido atualizado na Shopify", description: "Mudança de pagamento, envio ou status do pedido." },
  { id: "conversa_resolvida", label: "Conversa resolvida", description: "Quando a IA ou uma pessoa resolve a conversa." },
];

export const automationActionTypes: { id: string; label: string; consequential?: boolean }[] = [
  { id: "adicionar_tag", label: "Adicionar tag" },
  { id: "definir_prioridade", label: "Definir prioridade" },
  { id: "atribuir_equipe", label: "Atribuir a uma equipe" },
  { id: "encaminhar_revisao", label: "Encaminhar para revisão humana" },
  { id: "notificar", label: "Notificar pessoa" },
  { id: "enviar_template", label: "Enviar template" },
  { id: "cancelar_pedido", label: "Cancelar pedido", consequential: true },
  { id: "reembolsar", label: "Emitir reembolso", consequential: true },
];

export const roleMeta: Record<Role, { label: string; description: string }> = {
  proprietario: { label: "Proprietário", description: "Acesso total, incluindo cobrança e exclusão da organização." },
  administrador: { label: "Administrador", description: "Gerencia lojas, integrações, equipe e configurações." },
  supervisor: { label: "Supervisor", description: "Supervisiona o agente, revisa exceções e gerencia filas." },
  atendente: { label: "Atendente", description: "Assume conversas encaminhadas e responde clientes." },
  leitura: { label: "Somente leitura", description: "Visualiza conversas e relatórios, sem agir." },
};

export const memberStatusMeta: Record<MemberStatus, { label: string; tone: Tone }> = {
  ativo: { label: "Ativo", tone: "success" },
  convite_pendente: { label: "Convite pendente", tone: "warning" },
  convite_expirado: { label: "Convite expirado", tone: "danger" },
};

export const agentModeMeta: Record<AgentMode, { label: string; short: string; description: string }> = {
  off: {
    label: "Desativado",
    short: "Desativado",
    description: "O sistema não responde automaticamente. Todas as conversas ficam para a equipe.",
  },
  copilot: {
    label: "Copiloto",
    short: "Copiloto",
    description: "A IA prepara respostas para uma pessoa aprovar. Útil para testes e para canais sensíveis.",
  },
  auto: {
    label: "Automático",
    short: "Automático",
    description: "A IA atende o cliente diretamente, dentro das regras, fontes e limites configurados.",
  },
};
