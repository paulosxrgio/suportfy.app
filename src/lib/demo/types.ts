/**
 * Tipos de domínio usados pela interface.
 * Nesta etapa todos os valores vêm de dados demonstrativos em memória
 * (ver `src/lib/demo/data.ts`); nada é lido de serviços externos.
 */

export type Channel = "whatsapp" | "email";

export type StoreId = string;
export type StoreFilter = "all" | StoreId;

export interface Store {
  id: StoreId;
  name: string;
  /** Cor usada no marcador da loja (identificação rápida, não semântica). */
  color: string;
  orderPrefix: string;
  whatsappLabel: string;
  emailAddress: string;
}

export type AgentMode = "off" | "copilot" | "auto";

/** Estado da conversa do ponto de vista da supervisão do agente de IA. */
export type ConversationState =
  | "ai_active"
  | "awaiting_customer"
  | "awaiting_order_info"
  | "needs_review"
  | "human_assigned"
  | "auto_resolved"
  | "resolved"
  | "agent_paused"
  | "agent_error";

export type TicketStatus = "aberto" | "pendente" | "resolvido";

export type Priority = "baixa" | "normal" | "alta" | "urgente";

export type ContactReason =
  | "status_pedido"
  | "rastreamento"
  | "produto_danificado"
  | "troca"
  | "reembolso"
  | "cancelamento"
  | "alteracao_endereco"
  | "pagamento"
  | "duvida_produto"
  | "cupom"
  | "prazo_entrega"
  | "nota_fiscal"
  | "reclamacao";

export type DeliveryStatus =
  | "enviando"
  | "enviada"
  | "entregue"
  | "lida"
  | "falhou"
  /** Mensagem criada na demonstração: aparece na tela, mas não foi enviada. */
  | "demo";

export interface Attachment {
  name: string;
  kind: "image" | "pdf" | "file";
  size: string;
}

export type SourceKind = "order" | "knowledge" | "product" | "rule";

export interface Source {
  kind: SourceKind;
  /** Id do pedido, conteúdo de conhecimento ou regra. */
  refId?: string;
  label: string;
  detail: string;
}

export type MessageAuthor = "customer" | "ai" | "agent";

export interface MessageItem {
  id: string;
  type: "message";
  author: MessageAuthor;
  /** Id do membro da equipe quando `author` é "agent". */
  authorId?: string;
  at: string;
  body: string;
  delivery?: DeliveryStatus;
  failureReason?: string;
  attachments?: Attachment[];
  sources?: Source[];
  /** Resposta da IA aprovada por uma pessoa no modo copiloto. */
  approvedBy?: string;
  /** Resposta da IA sinalizada por uma pessoa como incorreta. */
  flagged?: boolean;
  /** Canal usado quando difere do canal de origem da conversa. */
  channel?: Channel;
}

export interface NoteItem {
  id: string;
  type: "note";
  authorId: string;
  at: string;
  body: string;
}

export type EventKind =
  | "classified"
  | "lookup"
  | "handoff"
  | "assigned"
  | "transferred"
  | "paused"
  | "returned_to_ai"
  | "resolved"
  | "reopened"
  | "error"
  | "draft";

export interface EventItem {
  id: string;
  type: "event";
  kind: EventKind;
  at: string;
  text: string;
  detail?: string;
}

export type TimelineItem = MessageItem | NoteItem | EventItem;

export interface AiDraft {
  body: string;
  sources: Source[];
  createdAt: string;
}

export interface Handoff {
  reason: string;
  rule: string;
  at: string;
}

export interface Conversation {
  id: string;
  ticketNumber: number;
  customerId: string;
  storeId: StoreId;
  channel: Channel;
  subject: string;
  reason: ContactReason;
  priority: Priority;
  state: ConversationState;
  /** Membro da equipe responsável. `null` quando a IA conduz ou ninguém assumiu. */
  assigneeId: string | null;
  teamId?: string;
  tags: string[];
  unreadCount: number;
  createdAt: string;
  lastActivityAt: string;
  slaDueAt: string | null;
  slaPaused: boolean;
  handoff?: Handoff;
  error?: string;
  pausedBy?: string;
  aiSummary: string;
  aiSuggestion?: string;
  aiDraft?: AiDraft;
  orderIds: string[];
  timeline: TimelineItem[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  storeId: StoreId;
  city: string;
  customerSince: string;
  tags: string[];
  notes: { id: string; authorId: string; at: string; body: string }[];
  lastActivityAt: string;
}

export type FinancialStatus = "pago" | "pendente" | "reembolsado" | "parcialmente_reembolsado";
export type FulfillmentStatus = "nao_enviado" | "em_transito" | "entregue" | "cancelado";
export type OrderStatus = "aberto" | "arquivado" | "cancelado";

export interface OrderItem {
  title: string;
  variant?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface TrackingEvent {
  at: string;
  description: string;
  location?: string;
}

export interface Order {
  id: string;
  number: string;
  storeId: StoreId;
  customerId: string;
  createdAt: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: string;
  items: OrderItem[];
  shipping: number;
  discount: number;
  refunded: number;
  address: { line: string; city: string; zip: string };
  tracking?: {
    carrier: string;
    code: string;
    estimatedDelivery: string;
    events: TrackingEvent[];
  };
}

export type KnowledgeStatus = "rascunho" | "publicado" | "arquivado";
export type KnowledgeType = "politica" | "faq" | "documento";

export interface KnowledgeVersion {
  version: number;
  at: string;
  authorId: string;
  note: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  type: KnowledgeType;
  status: KnowledgeStatus;
  storeIds: StoreId[] | "all";
  source: { kind: "manual" | "upload" | "url"; label: string };
  version: number;
  versions: KnowledgeVersion[];
  updatedAt: string;
  updatedBy: string;
  content: string;
}

export type AutomationState = "ativa" | "pausada" | "rascunho";
export type AutomationResult = "sucesso" | "falhou" | "sem_acao";

export interface AutomationCondition {
  field: string;
  operator: string;
  value: string;
}

export interface AutomationAction {
  type: string;
  value: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  trigger: string;
  storeId: StoreFilter;
  state: AutomationState;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  lastRun?: { at: string; result: AutomationResult; detail: string };
}

export type Role = "proprietario" | "administrador" | "supervisor" | "atendente" | "leitura";
export type MemberStatus = "ativo" | "convite_pendente" | "convite_expirado";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  teamIds: string[];
  storeIds: StoreId[] | "all";
  lastSeenAt?: string;
  invitedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
}

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  storeId: StoreFilter;
}

export interface TagDefinition {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: Channel | "ambos";
  category: string;
  status: "ativo" | "rascunho";
  body: string;
}

export interface AgentChannelSetting {
  mode: AgentMode;
  paused: boolean;
}

export type AgentTone = "cordial" | "formal" | "descontraido";
export type AgentLength = "curta" | "media" | "detalhada";

export interface AgentConfig {
  orgPaused: boolean;
  defaultMode: AgentMode;
  channels: Record<StoreId, Record<Channel, AgentChannelSetting>>;
  name: string;
  signatureByStore: Record<StoreId, string>;
  tone: AgentTone;
  length: AgentLength;
  instructions: string;
  schedule: "sempre" | "fora_do_horario" | "personalizado";
  maxAutoReplies: number;
  handoffOnHumanRequest: boolean;
  handoffOnNegativeSentiment: boolean;
  handoffCategories: string[];
  knowledgeSources: Record<string, boolean>;
  shopifySources: { orders: boolean; products: boolean; customers: boolean };
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  target: string;
}
