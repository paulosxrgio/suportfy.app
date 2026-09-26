import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { withSystem, type Db } from "../db/tx";

export const SESSION_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
}

/** Cria a sessão e devolve o token opaco que vai no cookie. Só o hash fica no banco. */
export async function createSession(db: Db, userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await withSystem(db, (tx) =>
    tx.query("INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [userId, hashToken(token), expiresAt]),
  );
  return { token, expiresAt };
}

export async function validateSession(db: Db, token: string | undefined, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  return withSystem(db, async (tx) => {
    const { rows } = await tx.query<{ id: string; user_id: string; email: string; name: string; expires_at: Date; last_seen_at: Date }>(
      `SELECT s.id, s.user_id, u.email, u.name, s.expires_at, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row) return null;
    if (row.expires_at <= now) {
      await tx.query("DELETE FROM sessions WHERE id = $1", [row.id]);
      return null;
    }
    // Atualiza o "visto por último" no máximo uma vez por hora.
    if (now.getTime() - row.last_seen_at.getTime() > 60 * 60 * 1000) {
      await tx.query("UPDATE sessions SET last_seen_at = $2 WHERE id = $1", [row.id, now]);
    }
    return { sessionId: row.id, userId: row.user_id, email: row.email, name: row.name };
  });
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await withSystem(db, (tx) => tx.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]));
}
