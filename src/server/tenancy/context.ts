import "server-only";
import type { Tx } from "../db/tx";
import { AppError } from "../errors";

export type MemberRole = "owner" | "admin" | "member";

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: MemberRole;
}

export interface StoreSummary {
  id: string;
  orgId: string;
  name: string;
}

/** Organizações do usuário da transação (RLS já restringe às dele). */
export async function listMemberships(tx: Tx): Promise<OrgMembership[]> {
  const { rows } = await tx.query<{ org_id: string; name: string; role: MemberRole }>(
    `SELECT m.org_id, o.name, m.role FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = app.current_user_id() ORDER BY o.created_at`,
  );
  return rows.map((r) => ({ orgId: r.org_id, orgName: r.name, role: r.role }));
}

export async function listStores(tx: Tx, orgId: string): Promise<StoreSummary[]> {
  const { rows } = await tx.query<{ id: string; org_id: string; name: string }>(
    "SELECT id, org_id, name FROM stores WHERE org_id = $1 ORDER BY created_at",
    [orgId],
  );
  return rows.map((r) => ({ id: r.id, orgId: r.org_id, name: r.name }));
}

/** Loja visível para o usuário, ou erro "não encontrado" (sem revelar se existe em outra organização). */
export async function requireStore(tx: Tx, storeId: string): Promise<StoreSummary> {
  const { rows } = await tx.query<{ id: string; org_id: string; name: string }>("SELECT id, org_id, name FROM stores WHERE id = $1", [storeId]);
  if (!rows[0]) throw new AppError("not_found", "Loja não encontrada.");
  return { id: rows[0].id, orgId: rows[0].org_id, name: rows[0].name };
}

export async function requireRole(tx: Tx, orgId: string, minimum: MemberRole): Promise<void> {
  const { rows } = await tx.query<{ ok: boolean }>("SELECT app.has_role($1, $2::app.member_role) AS ok", [orgId, minimum]);
  if (!rows[0]?.ok) throw new AppError("forbidden", "Você não tem permissão para esta ação.");
}
