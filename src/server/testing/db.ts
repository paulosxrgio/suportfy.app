import { randomBytes } from "node:crypto";
import pg from "pg";
import { migrate } from "../../../scripts/db-migrate.mjs";

/**
 * Banco de testes descartável: cria um banco novo a partir de
 * TEST_DATABASE_URL, aplica todas as migrations e remove no final.
 * Sem TEST_DATABASE_URL, os testes de integração são pulados.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

export interface TestDatabase {
  pool: pg.Pool;
  url: string;
  drop: () => Promise<void>;
}

function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL não definida.");
  const name = `suportfy_test_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = withDatabase(TEST_DATABASE_URL, name);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await migrate(client);
  await client.end();

  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return {
    pool,
    url,
    drop: async () => {
      await pool.end();
      const a = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}
