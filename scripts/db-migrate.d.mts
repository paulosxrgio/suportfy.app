import type pg from "pg";

export const MIGRATIONS_DIR: string;
export function listMigrations(dir?: string): Promise<{ version: string; sql: string; checksum: string }[]>;
export function migrate(client: pg.Client | pg.PoolClient, options?: { dir?: string; log?: (message: string) => void }): Promise<string[]>;
