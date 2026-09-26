import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "../db/tx";
import { findOrderByNumber, getConversation, getCustomer, listConversations, listCustomers, listOrdersForCustomer } from "../repos/support";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";
import { createTenant, type TenantFixture } from "../testing/fixtures";
import { listMemberships, requireStore } from "./context";

describe.skipIf(!hasTestDatabase)("isolamento entre organizações (RLS)", () => {
  let db: TestDatabase;
  let a: TenantFixture;
  let b: TenantFixture;

  beforeAll(async () => {
    db = await createTestDatabase();
    a = await createTenant(db.pool, "alfa");
    b = await createTenant(db.pool, "beta");
  });
  afterAll(async () => db?.drop());

  it("cada usuário vê só a própria organização e loja", async () => {
    await withTenant(db.pool, a.userId, async (tx) => {
      expect((await listMemberships(tx)).map((m) => m.orgId)).toEqual([a.orgId]);
      await expect(requireStore(tx, a.storeId)).resolves.toMatchObject({ id: a.storeId });
      await expect(requireStore(tx, b.storeId)).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("não acessa conversas de outra organização", async () => {
    await withTenant(db.pool, a.userId, async (tx) => {
      expect((await listConversations(tx, a.storeId)).map((c) => c.id)).toEqual([a.conversationId]);
      expect(await listConversations(tx, b.storeId)).toEqual([]);
      expect(await getConversation(tx, b.conversationId)).toBeNull();
      const own = await getConversation(tx, a.conversationId);
      expect(own?.messages).toHaveLength(1);
    });
  });

  it("não acessa clientes de outra organização", async () => {
    await withTenant(db.pool, a.userId, async (tx) => {
      expect(await listCustomers(tx, b.storeId)).toEqual([]);
      expect(await getCustomer(tx, b.customerId)).toBeNull();
      expect((await getCustomer(tx, a.customerId))?.id).toBe(a.customerId);
    });
  });

  it("não acessa pedidos de outra organização, nem pelo número", async () => {
    await withTenant(db.pool, a.userId, async (tx) => {
      expect(await listOrdersForCustomer(tx, b.customerId)).toEqual([]);
      expect(await findOrderByNumber(tx, b.storeId, b.orderNumber)).toBeNull();
      // Mesmo pedindo pela loja própria com o número da outra, nada vaza.
      expect(await findOrderByNumber(tx, a.storeId, b.orderNumber)).toBeNull();
      const own = await listOrdersForCustomer(tx, a.customerId);
      expect(own.map((o) => o.number)).toEqual([a.orderNumber]);
      expect(own[0].tracking?.code).toBe("AB123456789BR");
    });
  });

  it("SQL direto no papel da aplicação também é filtrado", async () => {
    await withTenant(db.pool, a.userId, async (tx) => {
      for (const table of ["organizations", "stores", "channels", "customers", "orders", "conversations", "messages"]) {
        const { rows } = await tx.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${table === "organizations" ? "id" : "org_id"} = $1`, [b.orgId]);
        expect(rows[0].n, table).toBe(0);
      }
      const users = await tx.query("SELECT id FROM users");
      expect(users.rows.map((r) => r.id)).toEqual([a.userId]);
    });
  });

  it("sem usuário definido, nada é visível", async () => {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE suportfy_app");
      const { rows } = await client.query("SELECT count(*)::int AS n FROM conversations");
      expect(rows[0].n).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("não grava dados em outra organização nem troca a organização de uma loja", async () => {
    await expect(
      withTenant(db.pool, a.userId, (tx) =>
        tx.query("INSERT INTO customers (org_id, store_id, name) VALUES ($1, $2, 'Intruso')", [b.orgId, b.storeId]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      withTenant(db.pool, a.userId, (tx) => tx.query("UPDATE stores SET org_id = $1 WHERE id = $2", [b.orgId, a.storeId])),
    ).rejects.toThrow(/permission denied/);
    const updated = await withTenant(db.pool, a.userId, (tx) =>
      tx.query("UPDATE conversations SET subject = 'x' WHERE id = $1", [b.conversationId]),
    );
    expect(updated.rowCount).toBe(0);
  });

  it("a aplicação não marca canais como conectados nem escreve pedidos ou mensagens", async () => {
    await expect(
      withTenant(db.pool, a.userId, (tx) => tx.query("UPDATE channels SET status = 'connected' WHERE store_id = $1", [a.storeId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withTenant(db.pool, a.userId, (tx) => tx.query("UPDATE orders SET total_cents = 0 WHERE store_id = $1", [a.storeId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withTenant(db.pool, a.userId, (tx) => tx.query("DELETE FROM messages WHERE store_id = $1", [a.storeId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("não lê hashes de senha nem sessões", async () => {
    await expect(withTenant(db.pool, a.userId, (tx) => tx.query("SELECT password_hash FROM users"))).rejects.toThrow(/permission denied/);
    await expect(withTenant(db.pool, a.userId, (tx) => tx.query("SELECT * FROM sessions"))).rejects.toThrow(/permission denied/);
  });
});
