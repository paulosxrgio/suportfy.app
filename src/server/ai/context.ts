import "server-only";
import type { Tx } from "../db/tx";
import { ORDER_COLUMNS, toOrder, type OrderRow } from "../repos/support";

/** Tudo que o agente sabe ao responder. Sempre restrito à loja da conversa. */
export interface AgentContext {
  conversationId: string;
  orgId: string;
  storeId: string;
  storeName: string;
  channel: "whatsapp" | "email";
  channelId: string;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  /** Pedidos do cliente e pedidos citados por número nas mensagens (mesma loja). */
  orders: OrderRow[];
  history: { author: "customer" | "ai" | "system"; body: string; at: Date }[];
  subject: string | null;
}

const ORDER_REF = /#?\b([A-Z]{2,4}-?\d{3,8})\b/gi;
const ORDER_REF_WITH_HASH = /#([A-Z]{2,4}-?\d{3,8})\b/gi;

/**
 * Números de pedido citados no texto, normalizados para "#AB1234". Clientes
 * costumam omitir o "#"; nas respostas da IA exigimos o "#" para não confundir
 * com cupons ou códigos de produto.
 */
export function extractOrderRefs(text: string, opts: { requireHash?: boolean } = {}): string[] {
  const refs = new Set<string>();
  for (const m of text.matchAll(opts.requireHash ? ORDER_REF_WITH_HASH : ORDER_REF)) refs.add(`#${m[1].replace("-", "").toUpperCase()}`);
  return [...refs];
}

export async function buildContext(tx: Tx, conversationId: string, historyLimit = 20): Promise<AgentContext | null> {
  const conv = await tx.query(
    `SELECT c.id, c.org_id, c.store_id, s.name AS store_name, ch.kind, ch.id AS channel_id, c.subject,
            cu.id AS customer_id, cu.name AS customer_name, cu.email, cu.phone
     FROM conversations c
     JOIN stores s ON s.id = c.store_id
     JOIN channels ch ON ch.id = c.channel_id
     JOIN customers cu ON cu.id = c.customer_id
     WHERE c.id = $1`,
    [conversationId],
  );
  const c = conv.rows[0];
  if (!c) return null;

  const messages = await tx.query<{ author: "customer" | "ai" | "system"; body: string; created_at: Date }>(
    `SELECT author, body, created_at FROM (
       SELECT author, body, created_at, id FROM messages
       WHERE conversation_id = $1 AND status <> 'blocked'
       ORDER BY created_at DESC, id DESC LIMIT $2
     ) recent ORDER BY created_at, id`,
    [conversationId, historyLimit],
  );

  const refs = extractOrderRefs(messages.rows.filter((m) => m.author === "customer").map((m) => m.body).join("\n"));
  // Pedidos do próprio cliente + os citados por número, sempre filtrando pela loja da conversa.
  const orders = await tx.query(
    `SELECT ${ORDER_COLUMNS} FROM orders
     WHERE store_id = $1 AND (customer_id = $2 OR upper(number) = ANY($3::text[]))
     ORDER BY placed_at DESC LIMIT 20`,
    [c.store_id, c.customer_id, refs],
  );

  return {
    conversationId: c.id,
    orgId: c.org_id,
    storeId: c.store_id,
    storeName: c.store_name,
    channel: c.kind,
    channelId: c.channel_id,
    customer: { id: c.customer_id, name: c.customer_name, email: c.email, phone: c.phone },
    orders: orders.rows.map(toOrder),
    history: messages.rows.map((m) => ({ author: m.author, body: m.body, at: m.created_at })),
    subject: c.subject,
  };
}

const financial: Record<string, string> = {
  pending: "pagamento pendente",
  paid: "pago",
  refunded: "reembolsado",
  partially_refunded: "parcialmente reembolsado",
  voided: "cancelado",
};
const fulfillment: Record<string, string> = {
  unfulfilled: "ainda não enviado",
  in_transit: "em trânsito",
  delivered: "entregue",
  cancelled: "cancelado",
};

/** Instruções e dados do contexto no formato enviado ao modelo. */
export function renderSystemPrompt(ctx: AgentContext): string {
  const orders = ctx.orders.length
    ? ctx.orders
        .map((o) => {
          const items = o.items.map((i) => `${i.quantity}x ${i.title}`).join(", ");
          const tracking = o.tracking?.code
            ? `; rastreio ${o.tracking.carrier ?? ""} ${o.tracking.code}${o.tracking.estimatedDelivery ? `, previsão ${o.tracking.estimatedDelivery}` : ""}`
            : "";
          return `- ${o.number}: ${financial[o.financialStatus] ?? o.financialStatus}, ${fulfillment[o.fulfillmentStatus] ?? o.fulfillmentStatus}; ${items}${tracking}`;
        })
        .join("\n")
    : "- Nenhum pedido encontrado para este cliente nesta loja.";
  return [
    `Você é o atendente virtual da loja ${ctx.storeName}, respondendo por ${ctx.channel === "whatsapp" ? "WhatsApp" : "e-mail"} em português do Brasil.`,
    "Regras:",
    "- Use somente os dados de pedidos abaixo. Nunca invente status, prazos, códigos de rastreio, valores ou políticas.",
    "- Se o cliente não informou qual é o pedido e houver dúvida, peça o número do pedido e marque needs_customer_info.",
    "- Não prometa reembolso, troca, cancelamento ou alteração de endereço: diga que o pedido foi registrado e será analisado conforme as regras da loja.",
    "- Liste em referenced_orders todo número de pedido que aparecer na resposta.",
    "- Seja cordial e objetivo.",
    "",
    `Cliente: ${ctx.customer.name || "sem nome"}.`,
    "Pedidos disponíveis:",
    orders,
  ].join("\n");
}
