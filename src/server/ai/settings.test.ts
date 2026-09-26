import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp } from "../auth/service";
import { withSystem, withTenant } from "../db/tx";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";
import { createTenant, type TenantFixture } from "../testing/fixtures";
import { getAgentSettings, setAgentEnabled } from "./settings";

describe.skipIf(!hasTestDatabase)("atendimento automático por loja", () => {
  let db: TestDatabase;
  let a: TenantFixture;
  let b: TenantFixture;
  beforeAll(async () => {
    db = await createTestDatabase();
    a = await createTenant(db.pool, "alfa");
    b = await createTenant(db.pool, "beta");
  });
  afterAll(async () => db?.drop());

  it("começa desligado e o administrador liga e desliga", async () => {
    expect(await withTenant(db.pool, a.userId, (tx) => getAgentSettings(tx, a.storeId))).toMatchObject({ enabled: false });
    expect(await setAgentEnabled(db.pool, a.userId, a.storeId, true)).toMatchObject({ enabled: true });
    expect(await setAgentEnabled(db.pool, a.userId, a.storeId, false)).toMatchObject({ enabled: false });
  });

  it("outra organização e membros sem papel de administrador não alteram", async () => {
    await expect(setAgentEnabled(db.pool, b.userId, a.storeId, true)).rejects.toMatchObject({ code: "not_found" });
    const member = await signUp(db.pool, { name: "Membro", email: "membro-agente@example.com", password: "senha-longa-123", organizationName: "X", storeName: "X" });
    await withSystem(db.pool, (tx) => tx.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'member')", [a.orgId, member.userId]));
    await expect(setAgentEnabled(db.pool, member.userId, a.storeId, true)).rejects.toMatchObject({ code: "forbidden" });
    expect(await withTenant(db.pool, b.userId, (tx) => getAgentSettings(tx, a.storeId))).toBeNull();
  });
});
