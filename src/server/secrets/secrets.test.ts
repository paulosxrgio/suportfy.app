import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withSystem, withTenant } from "../db/tx";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";
import { createTenant, type TenantFixture } from "../testing/fixtures";
import { open, seal } from "./crypto";
import { deleteSecret, listSecretMetadata, readSecretForServerUse, setSecret, type SecretKeyring } from "./service";

const keyring: SecretKeyring = { current: { version: 1, key: randomBytes(32) } };
const OPENAI_KEY = "sk-test-" + "a".repeat(30) + "Z9x1";

describe("cifragem de segredos", () => {
  it("decifra só com a mesma chave e o mesmo escopo", () => {
    const sealed = seal("segredo", keyring.current.key, 1, "org-a:org:openai_api_key");
    expect(sealed.ciphertext.toString("utf8")).not.toContain("segredo");
    expect(open(sealed, keyring.current.key, "org-a:org:openai_api_key")).toBe("segredo");
    expect(() => open(sealed, keyring.current.key, "org-b:org:openai_api_key")).toThrow();
    expect(() => open(sealed, randomBytes(32), "org-a:org:openai_api_key")).toThrow();
  });
});

describe.skipIf(!hasTestDatabase)("chave da OpenAI por organização (banco real)", () => {
  let db: TestDatabase;
  let a: TenantFixture;
  let b: TenantFixture;

  beforeAll(async () => {
    db = await createTestDatabase();
    a = await createTenant(db.pool, "alfa");
    b = await createTenant(db.pool, "beta");
  });
  afterAll(async () => db?.drop());

  it("grava cifrada e devolve só metadados", async () => {
    const meta = await setSecret(db.pool, keyring, a.userId, { orgId: a.orgId, kind: "openai_api_key", value: OPENAI_KEY });
    expect(meta).toMatchObject({ kind: "openai_api_key", storeId: null, last4: "Z9x1" });
    expect(JSON.stringify(meta)).not.toContain(OPENAI_KEY);

    const raw = await withSystem(db.pool, (tx) => tx.query("SELECT ciphertext::text AS c FROM secrets WHERE org_id = $1", [a.orgId]));
    expect(raw.rows[0].c).not.toContain(OPENAI_KEY.slice(3, 20));
  });

  it("o papel da aplicação não lê a cifra, só os metadados da própria organização", async () => {
    await expect(withTenant(db.pool, a.userId, (tx) => tx.query("SELECT ciphertext FROM secrets"))).rejects.toThrow(/permission denied/);
    const own = await withTenant(db.pool, a.userId, (tx) => listSecretMetadata(tx, a.orgId));
    expect(own.map((m) => m.last4)).toEqual(["Z9x1"]);
    const other = await withTenant(db.pool, b.userId, (tx) => listSecretMetadata(tx, a.orgId));
    expect(other).toEqual([]);
  });

  it("outra organização não grava nem apaga a chave", async () => {
    await expect(setSecret(db.pool, keyring, b.userId, { orgId: a.orgId, kind: "openai_api_key", value: OPENAI_KEY })).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(deleteSecret(db.pool, b.userId, { orgId: a.orgId, kind: "openai_api_key" })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("valida o formato e usa a chave da loja antes da chave da organização", async () => {
    await expect(setSecret(db.pool, keyring, a.userId, { orgId: a.orgId, kind: "openai_api_key", value: "abc" })).rejects.toMatchObject({
      code: "invalid_input",
    });
    const storeKey = "sk-loja-" + "b".repeat(30) + "Q7w2";
    await setSecret(db.pool, keyring, a.userId, { orgId: a.orgId, storeId: a.storeId, kind: "openai_api_key", value: storeKey });
    const value = await withSystem(db.pool, (tx) =>
      readSecretForServerUse(tx, keyring, { orgId: a.orgId, storeId: a.storeId, kind: "openai_api_key" }),
    );
    expect(value).toBe(storeKey);
    // Loja de outra organização nunca recebe a chave de A.
    const leak = await withSystem(db.pool, (tx) => readSecretForServerUse(tx, keyring, { orgId: b.orgId, storeId: b.storeId, kind: "openai_api_key" }));
    expect(leak).toBeNull();
  });

  it("linha copiada para outra organização não decifra", async () => {
    await withSystem(db.pool, (tx) =>
      tx.query(
        `INSERT INTO secrets (org_id, store_id, kind, ciphertext, iv, auth_tag, key_version, last4)
         SELECT $1, NULL, kind, ciphertext, iv, auth_tag, key_version, last4 FROM secrets WHERE org_id = $2 AND store_id IS NULL`,
        [b.orgId, a.orgId],
      ),
    );
    await expect(
      withSystem(db.pool, (tx) => readSecretForServerUse(tx, keyring, { orgId: b.orgId, storeId: b.storeId, kind: "openai_api_key" })),
    ).rejects.toThrow();
  });
});
