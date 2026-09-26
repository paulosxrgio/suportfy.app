import { randomBytes } from "node:crypto";
import type pg from "pg";
import { signUp } from "../auth/service";
import { withSystem } from "../db/tx";

export interface TenantFixture {
  userId: string;
  orgId: string;
  storeId: string;
  whatsappChannelId: string;
  emailChannelId: string;
  customerId: string;
  orderId: string;
  orderNumber: string;
  conversationId: string;
  email: string;
  password: string;
}

/** Cria uma organização completa (usuário, loja, canais, cliente, pedido e conversa). */
export async function createTenant(pool: pg.Pool, label: string): Promise<TenantFixture> {
  const suffix = randomBytes(3).toString("hex");
  const email = `${label}-${suffix}@example.com`;
  const password = "senha-de-teste-123";
  const { userId, orgId, storeId } = await signUp(pool, {
    name: `Pessoa ${label}`,
    email,
    password,
    organizationName: `Organização ${label}`,
    storeName: `Loja ${label}`,
  });
  return withSystem(pool, async (tx) => {
    const channels = await tx.query<{ id: string; kind: string }>("SELECT id, kind FROM channels WHERE store_id = $1", [storeId]);
    const whatsappChannelId = channels.rows.find((c) => c.kind === "whatsapp")!.id;
    const emailChannelId = channels.rows.find((c) => c.kind === "email")!.id;
    const customer = await tx.query<{ id: string }>(
      "INSERT INTO customers (org_id, store_id, name, email, phone, source) VALUES ($1, $2, $3, $4, $5, 'demo') RETURNING id",
      [orgId, storeId, `Cliente ${label}`, `cliente-${label}-${suffix}@example.com`, `55119${randomBytes(4).readUInt32BE() % 100000000}`.slice(0, 13)],
    );
    const customerId = customer.rows[0].id;
    const orderNumber = `#${label.toUpperCase().slice(0, 2)}${1000 + (randomBytes(1)[0] % 900)}`;
    const order = await tx.query<{ id: string }>(
      `INSERT INTO orders (org_id, store_id, customer_id, number, financial_status, fulfillment_status, total_cents, items, tracking, placed_at, source)
       VALUES ($1, $2, $3, $4, 'paid', 'in_transit', 28990, $5, $6, now() - interval '3 days', 'demo') RETURNING id`,
      [
        orgId,
        storeId,
        customerId,
        orderNumber,
        JSON.stringify([{ title: "Kit Rotina Completa", quantity: 1 }]),
        JSON.stringify({ carrier: "Correios", code: "AB123456789BR", estimatedDelivery: "2026-09-30" }),
      ],
    );
    const conversation = await tx.query<{ id: string }>(
      "INSERT INTO conversations (org_id, store_id, channel_id, customer_id, subject) VALUES ($1, $2, $3, $4, 'Onde está meu pedido?') RETURNING id",
      [orgId, storeId, whatsappChannelId, customerId],
    );
    const conversationId = conversation.rows[0].id;
    await tx.query(
      `INSERT INTO messages (org_id, store_id, conversation_id, direction, author, body, status, idempotency_key)
       VALUES ($1, $2, $3, 'inbound', 'customer', 'Oi, onde está meu pedido?', 'received', $4)`,
      [orgId, storeId, conversationId, `fixture:${conversationId}`],
    );
    return {
      userId,
      orgId,
      storeId,
      whatsappChannelId,
      emailChannelId,
      customerId,
      orderId: order.rows[0].id,
      orderNumber,
      conversationId,
      email,
      password,
    };
  });
}
