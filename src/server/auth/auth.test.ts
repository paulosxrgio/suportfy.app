import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSystem } from "../db/tx";
import { AppError } from "../errors";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";
import { hashPassword, verifyPassword } from "./password";
import { signIn, signUp } from "./service";
import { createSession, deleteSession, validateSession } from "./sessions";

describe("senhas", () => {
  it("gera hash com sal e confere só a senha certa", async () => {
    const a = await hashPassword("uma senha longa");
    const b = await hashPassword("uma senha longa");
    expect(a).not.toBe(b);
    expect(a).not.toContain("uma senha longa");
    expect(await verifyPassword("uma senha longa", a)).toBe(true);
    expect(await verifyPassword("outra senha", a)).toBe(false);
    expect(await verifyPassword("x", "formato-invalido")).toBe(false);
  });
});

describe.skipIf(!hasTestDatabase)("autenticação (banco real)", () => {
  let db: TestDatabase;
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  afterAll(async () => db?.drop());

  const input = {
    name: "Marina Costa",
    email: "Marina@Example.com",
    password: "senha-bem-longa-1",
    organizationName: "Grupo Horizonte",
    storeName: "Aurora Cosméticos",
  };

  it("cria usuário, organização com proprietário, loja, canais desconectados e IA desligada", async () => {
    const { userId, orgId, storeId } = await signUp(db.pool, input);
    await withSystem(db.pool, async (tx) => {
      const user = await tx.query("SELECT email, password_hash FROM users WHERE id = $1", [userId]);
      expect(user.rows[0].email).toBe("marina@example.com");
      expect(user.rows[0].password_hash).toMatch(/^scrypt\$/);
      expect(user.rows[0].password_hash).not.toContain(input.password);
      const member = await tx.query("SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2", [orgId, userId]);
      expect(member.rows[0].role).toBe("owner");
      const channels = await tx.query("SELECT kind, provider, status FROM channels WHERE store_id = $1 ORDER BY kind", [storeId]);
      expect(channels.rows).toEqual([
        { kind: "email", provider: "resend", status: "disconnected" },
        { kind: "whatsapp", provider: "evolution", status: "disconnected" },
      ]);
      const ai = await tx.query("SELECT enabled FROM ai_settings WHERE store_id = $1", [storeId]);
      expect(ai.rows[0].enabled).toBe(false);
    });
  });

  it("recusa e-mail repetido e dados inválidos", async () => {
    await expect(signUp(db.pool, input)).rejects.toMatchObject({ code: "email_taken" });
    await expect(signUp(db.pool, { ...input, email: "x@example.com", password: "curta" })).rejects.toBeInstanceOf(AppError);
  });

  it("entra só com a senha correta", async () => {
    await expect(signIn(db.pool, { email: "marina@example.com", password: input.password })).resolves.toHaveProperty("userId");
    await expect(signIn(db.pool, { email: "marina@example.com", password: "errada" })).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(signIn(db.pool, { email: "ninguem@example.com", password: "qualquer" })).rejects.toMatchObject({ code: "invalid_credentials" });
  });

  it("sessão guarda só o hash do token, expira e é encerrada no logout", async () => {
    const { userId } = await signIn(db.pool, { email: "marina@example.com", password: input.password });
    const now = new Date("2026-09-26T12:00:00Z");
    const { token } = await createSession(db.pool, userId, now);
    const stored = await withSystem(db.pool, (tx) => tx.query("SELECT token_hash FROM sessions WHERE user_id = $1", [userId]));
    expect(stored.rows.map((r) => r.token_hash)).not.toContain(token);

    expect(await validateSession(db.pool, token, now)).toMatchObject({ userId, email: "marina@example.com" });
    expect(await validateSession(db.pool, "token-inexistente", now)).toBeNull();
    expect(await validateSession(db.pool, token, new Date("2026-12-31T00:00:00Z"))).toBeNull();

    const second = await createSession(db.pool, userId, now);
    await deleteSession(db.pool, second.token);
    expect(await validateSession(db.pool, second.token, now)).toBeNull();
  });
});
