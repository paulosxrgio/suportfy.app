import "server-only";
import { z } from "zod";
import { withSystem, withTenant, type Db, type Tx } from "../db/tx";
import { AppError } from "../errors";
import { requireRole } from "../tenancy/context";
import { open, seal } from "./crypto";

export type SecretKind = "openai_api_key" | "evolution_api_key" | "resend_api_key";

export interface SecretKeyring {
  /** Chave atual (versão `version`) e, opcionalmente, anteriores para decifrar. */
  current: { version: number; key: Buffer };
  previous?: { version: number; key: Buffer }[];
}

/** Metadados que podem ir para a interface. O valor nunca sai do servidor. */
export interface SecretMetadata {
  kind: SecretKind;
  storeId: string | null;
  last4: string;
  updatedAt: Date;
  updatedBy: string | null;
}

const valueSchemas: Record<SecretKind, z.ZodString> = {
  openai_api_key: z.string().trim().regex(/^sk-[A-Za-z0-9_-]{20,200}$/, "A chave da OpenAI começa com \"sk-\" e tem pelo menos 23 caracteres."),
  evolution_api_key: z.string().trim().min(16, "Chave da Evolution API muito curta.").max(300),
  resend_api_key: z.string().trim().regex(/^re_[A-Za-z0-9_]{10,200}$/, "A chave da Resend começa com \"re_\"."),
};

function aad(orgId: string, storeId: string | null, kind: SecretKind): string {
  return `${orgId}:${storeId ?? "org"}:${kind}`;
}

/**
 * Grava (ou substitui) um segredo. Exige papel de administrador na organização,
 * conferido no contexto do usuário; a gravação acontece em contexto de sistema
 * porque o papel da aplicação não tem acesso às colunas cifradas.
 */
export async function setSecret(
  db: Db,
  keyring: SecretKeyring,
  userId: string,
  input: { orgId: string; storeId?: string | null; kind: SecretKind; value: string },
): Promise<SecretMetadata> {
  const storeId = input.storeId ?? null;
  const parsed = valueSchemas[input.kind].safeParse(input.value);
  if (!parsed.success) throw new AppError("invalid_input", parsed.error.issues[0]?.message ?? "Valor inválido.");
  const value = parsed.data;

  await withTenant(db, userId, async (tx) => {
    await requireRole(tx, input.orgId, "admin");
    if (storeId) {
      const { rows } = await tx.query("SELECT 1 FROM stores WHERE id = $1 AND org_id = $2", [storeId, input.orgId]);
      if (!rows[0]) throw new AppError("not_found", "Loja não encontrada.");
    }
  });

  const sealed = seal(value, keyring.current.key, keyring.current.version, aad(input.orgId, storeId, input.kind));
  const last4 = value.slice(-4);
  const { rows } = await withSystem(db, (tx) =>
    tx.query<{ updated_at: Date }>(
      `INSERT INTO secrets (org_id, store_id, kind, ciphertext, iv, auth_tag, key_version, last4, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (org_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
       DO UPDATE SET ciphertext = EXCLUDED.ciphertext, iv = EXCLUDED.iv, auth_tag = EXCLUDED.auth_tag,
         key_version = EXCLUDED.key_version, last4 = EXCLUDED.last4, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING updated_at`,
      [input.orgId, storeId, input.kind, sealed.ciphertext, sealed.iv, sealed.authTag, sealed.keyVersion, last4, userId],
    ),
  );
  return { kind: input.kind, storeId, last4, updatedAt: rows[0].updated_at, updatedBy: userId };
}

export async function deleteSecret(db: Db, userId: string, input: { orgId: string; storeId?: string | null; kind: SecretKind }): Promise<void> {
  await withTenant(db, userId, (tx) => requireRole(tx, input.orgId, "admin"));
  await withSystem(db, (tx) =>
    tx.query("DELETE FROM secrets WHERE org_id = $1 AND store_id IS NOT DISTINCT FROM $2 AND kind = $3", [input.orgId, input.storeId ?? null, input.kind]),
  );
}

/** Metadados visíveis a membros da organização (a RLS filtra as outras). */
export async function listSecretMetadata(tx: Tx, orgId: string): Promise<SecretMetadata[]> {
  const { rows } = await tx.query(
    "SELECT kind, store_id, last4, updated_at, updated_by FROM secrets WHERE org_id = $1 ORDER BY kind, store_id NULLS FIRST",
    [orgId],
  );
  return rows.map((r) => ({ kind: r.kind, storeId: r.store_id, last4: r.last4, updatedAt: r.updated_at, updatedBy: r.updated_by }));
}

/**
 * Valor decifrado para uso interno do servidor (chamada ao provedor). Procura
 * primeiro o segredo da loja e depois o da organização. Nunca devolva este
 * valor em respostas nem o registre em logs.
 */
export async function readSecretForServerUse(
  tx: Tx,
  keyring: SecretKeyring,
  scope: { orgId: string; storeId: string; kind: SecretKind },
): Promise<string | null> {
  const { rows } = await tx.query<{ store_id: string | null; ciphertext: Buffer; iv: Buffer; auth_tag: Buffer; key_version: number }>(
    `SELECT store_id, ciphertext, iv, auth_tag, key_version FROM secrets
     WHERE org_id = $1 AND kind = $3 AND (store_id = $2 OR store_id IS NULL)
     ORDER BY store_id NULLS LAST LIMIT 1`,
    [scope.orgId, scope.storeId, scope.kind],
  );
  const row = rows[0];
  if (!row) return null;
  const keys = [keyring.current, ...(keyring.previous ?? [])];
  const key = keys.find((k) => k.version === row.key_version);
  if (!key) throw new Error(`Chave de cifragem versão ${row.key_version} indisponível.`);
  return open({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag }, key.key, aad(scope.orgId, row.store_id, scope.kind));
}
