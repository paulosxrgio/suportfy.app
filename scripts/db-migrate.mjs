// Aplica as migrations SQL de `db/migrations` em ordem, uma transação por arquivo.
//
// - Registra cada arquivo em `schema_migrations` com o SHA-256 do conteúdo.
// - Recusa continuar se um arquivo já aplicado foi alterado (migrations são imutáveis:
//   correções entram em um arquivo novo).
// - Usa advisory lock para que dois deploys não apliquem ao mesmo tempo.
//
// Uso: DATABASE_URL=postgres://... npm run db:migrate
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const LOCK_ID = 7_240_111;
export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

export async function listMigrations(dir = MIGRATIONS_DIR) {
  const files = (await readdir(dir)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return Promise.all(
    files.map(async (file) => {
      const sql = await readFile(path.join(dir, file), "utf8");
      return { version: file.replace(/\.sql$/, ""), sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }),
  );
}

/** Aplica o que falta. Devolve as versões aplicadas nesta execução. */
export async function migrate(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query("SELECT version, checksum FROM schema_migrations");
    const applied = new Map(rows.map((r) => [r.version, r.checksum]));
    const migrations = await listMigrations(dir);

    for (const [version, checksum] of applied) {
      const current = migrations.find((m) => m.version === version);
      if (!current) throw new Error(`Migration ${version} está aplicada no banco, mas não existe no repositório.`);
      if (current.checksum !== checksum) {
        throw new Error(`Migration ${version} foi alterada depois de aplicada. Crie uma migration nova em vez de editar.`);
      }
    }

    const done = [];
    for (const m of migrations) {
      if (applied.has(m.version)) continue;
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [m.version, m.checksum]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Falha ao aplicar ${m.version}: ${error.message}`);
      }
      log(`aplicada ${m.version}`);
      done.push(m.version);
    }
    return done;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Defina DATABASE_URL para aplicar as migrations.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const done = await migrate(client, { log: (m) => console.log(m) });
    console.log(done.length ? `${done.length} migration(s) aplicada(s).` : "Banco já está atualizado.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
