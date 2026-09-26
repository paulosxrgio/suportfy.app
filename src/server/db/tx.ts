import "server-only";
import type pg from "pg";

/** Transação aberta. Tudo que o servidor faz no banco passa por uma destas. */
export interface Tx {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
}

export type Db = pg.Pool;

async function inTransaction<T>(db: Db, setup: (client: pg.PoolClient) => Promise<void>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await setup(client);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Transação no contexto de um usuário: papel restrito `suportfy_app` e
 * `app.user_id` definidos só para esta transação. As políticas RLS garantem
 * que só os dados das organizações do usuário ficam visíveis.
 */
export function withTenant<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(
    db,
    async (client) => {
      await client.query("SET LOCAL ROLE suportfy_app");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    },
    fn,
  );
}

/**
 * Transação de sistema (dono das tabelas, sem RLS). Use só onde não há usuário
 * da requisição: login, cadastro, webhooks já autenticados por assinatura,
 * leitura de segredos e o pipeline do agente. Sempre filtre por loja/organização.
 */
export function withSystem<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inTransaction(db, async () => {}, fn);
}
