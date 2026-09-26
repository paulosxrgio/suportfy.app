import "server-only";
import pg from "pg";
import { serverEnv } from "../env";

const globalForPool = globalThis as unknown as { suportfyPool?: pg.Pool };

/** Pool único por processo (reaproveitado entre recargas no desenvolvimento). */
export function getPool(): pg.Pool {
  if (!globalForPool.suportfyPool) {
    const { DATABASE_URL } = serverEnv();
    if (!DATABASE_URL) throw new Error("Backend não configurado: defina DATABASE_URL.");
    globalForPool.suportfyPool = new pg.Pool({ connectionString: DATABASE_URL, max: 10, idleTimeoutMillis: 30_000 });
  }
  return globalForPool.suportfyPool;
}
