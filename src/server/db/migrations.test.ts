import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listMigrations, migrate } from "../../../scripts/db-migrate.mjs";
import { createTestDatabase, hasTestDatabase, type TestDatabase } from "../testing/db";

describe.skipIf(!hasTestDatabase)("migrations", () => {
  let db: TestDatabase;
  let client: pg.Client;

  beforeAll(async () => {
    db = await createTestDatabase(); // já aplica todas numa base limpa
    client = new pg.Client({ connectionString: db.url });
    await client.connect();
  });
  afterAll(async () => {
    await client?.end();
    await db?.drop();
  });

  it("aplica todas numa base limpa e reaplicar não faz nada", async () => {
    const files = await listMigrations();
    const { rows } = await client.query("SELECT version FROM schema_migrations ORDER BY version");
    expect(rows.map((r) => r.version)).toEqual(files.map((f: { version: string }) => f.version));
    expect(await migrate(client)).toEqual([]);
  });

  it("recusa migration alterada depois de aplicada", async () => {
    await client.query("UPDATE schema_migrations SET checksum = 'x' WHERE version = '0001_roles_and_helpers'");
    await expect(migrate(client)).rejects.toThrow(/alterada depois de aplicada/);
  });

  it("todas as tabelas de dados têm RLS ligado", async () => {
    const { rows } = await client.query(
      `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
       AND relname <> 'schema_migrations' AND NOT relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});
