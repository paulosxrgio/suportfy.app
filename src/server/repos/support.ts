import "server-only";
import type { Tx } from "../db/tx";

/*
 * Leitura dos dados de atendimento no contexto do usuário. Todas as consultas
 * recebem a loja explicitamente e ainda passam pelas políticas RLS: um id de
 * outra organização simplesmente não retorna linhas.
 */

export type ChannelKind = "whatsapp" | "email";

export interface ConversationRow {
  id: string;
  storeId: string;
  channel: ChannelKind;
  customerId: string;
  customerName: string;
  status: "open" | "resolved";
  aiStatus: "active" | "paused" | "error";
  subject: string | null;
  lastMessageAt: Date;
}

export async function listConversations(tx: Tx, storeId: string, channel?: ChannelKind): Promise<ConversationRow[]> {
  const { rows } = await tx.query(
    `SELECT c.id, c.store_id, ch.kind, c.customer_id, cu.name, c.status, c.ai_status, c.subject, c.last_message_at
     FROM conversations c
     JOIN channels ch ON ch.id = c.channel_id
     JOIN customers cu ON cu.id = c.customer_id
     WHERE c.store_id = $1 AND ($2::text IS NULL OR ch.kind = $2)
     ORDER BY c.last_message_at DESC
     LIMIT 200`,
    [storeId, channel ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    storeId: r.store_id,
    channel: r.kind,
    customerId: r.customer_id,
    customerName: r.name,
    status: r.status,
    aiStatus: r.ai_status,
    subject: r.subject,
    lastMessageAt: r.last_message_at,
  }));
}

export interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  author: "customer" | "ai" | "system";
  body: string;
  status: string;
  createdAt: Date;
}

export async function getConversation(tx: Tx, conversationId: string): Promise<(ConversationRow & { messages: MessageRow[] }) | null> {
  const { rows } = await tx.query(
    `SELECT c.id, c.store_id, ch.kind, c.customer_id, cu.name, c.status, c.ai_status, c.subject, c.last_message_at
     FROM conversations c JOIN channels ch ON ch.id = c.channel_id JOIN customers cu ON cu.id = c.customer_id
     WHERE c.id = $1`,
    [conversationId],
  );
  const r = rows[0];
  if (!r) return null;
  const messages = await tx.query(
    "SELECT id, direction, author, body, status, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at, id",
    [conversationId],
  );
  return {
    id: r.id,
    storeId: r.store_id,
    channel: r.kind,
    customerId: r.customer_id,
    customerName: r.name,
    status: r.status,
    aiStatus: r.ai_status,
    subject: r.subject,
    lastMessageAt: r.last_message_at,
    messages: messages.rows.map((m) => ({
      id: m.id,
      direction: m.direction,
      author: m.author,
      body: m.body,
      status: m.status,
      createdAt: m.created_at,
    })),
  };
}

export interface CustomerRow {
  id: string;
  storeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
}

export async function listCustomers(tx: Tx, storeId: string): Promise<CustomerRow[]> {
  const { rows } = await tx.query(
    "SELECT id, store_id, name, email, phone, source FROM customers WHERE store_id = $1 ORDER BY name LIMIT 500",
    [storeId],
  );
  return rows.map((r) => ({ id: r.id, storeId: r.store_id, name: r.name, email: r.email, phone: r.phone, source: r.source }));
}

export async function getCustomer(tx: Tx, customerId: string): Promise<CustomerRow | null> {
  const { rows } = await tx.query("SELECT id, store_id, name, email, phone, source FROM customers WHERE id = $1", [customerId]);
  const r = rows[0];
  return r ? { id: r.id, storeId: r.store_id, name: r.name, email: r.email, phone: r.phone, source: r.source } : null;
}

export interface OrderRow {
  id: string;
  storeId: string;
  customerId: string | null;
  number: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  currency: string;
  items: { title: string; quantity: number }[];
  tracking: { carrier?: string; code?: string; url?: string; estimatedDelivery?: string } | null;
  placedAt: Date;
  source: "shopify" | "demo";
}

export const ORDER_COLUMNS =
  "id, store_id, customer_id, number, financial_status, fulfillment_status, total_cents, currency, items, tracking, placed_at, source";

export function toOrder(r: Record<string, unknown>): OrderRow {
  return {
    id: r.id as string,
    storeId: r.store_id as string,
    customerId: (r.customer_id as string | null) ?? null,
    number: r.number as string,
    financialStatus: r.financial_status as string,
    fulfillmentStatus: r.fulfillment_status as string,
    totalCents: Number(r.total_cents),
    currency: (r.currency as string).trim(),
    items: (r.items as OrderRow["items"]) ?? [],
    tracking: (r.tracking as OrderRow["tracking"]) ?? null,
    placedAt: r.placed_at as Date,
    source: r.source as OrderRow["source"],
  };
}

export async function listOrdersForCustomer(tx: Tx, customerId: string): Promise<OrderRow[]> {
  const { rows } = await tx.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE customer_id = $1 ORDER BY placed_at DESC LIMIT 50`, [customerId]);
  return rows.map(toOrder);
}

export async function findOrderByNumber(tx: Tx, storeId: string, number: string): Promise<OrderRow | null> {
  const { rows } = await tx.query(`SELECT ${ORDER_COLUMNS} FROM orders WHERE store_id = $1 AND number = $2`, [storeId, number]);
  return rows[0] ? toOrder(rows[0]) : null;
}
