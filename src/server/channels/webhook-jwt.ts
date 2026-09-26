import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verificação do JWT que a Evolution API envia em cada entrega de webhook
 * quando o cabeçalho `jwt_key` está configurado: HS256 assinado com a chave
 * do canal, `exp` = `iat` + 600 s e payload { app: "evolution", action: "webhook" }.
 *
 * Aceita só HS256 (recusa "none" e qualquer outro algoritmo) e compara a
 * assinatura em tempo constante.
 */

export type JwtCheck = { ok: true } | { ok: false; reason: "malformed" | "bad_algorithm" | "bad_signature" | "expired" | "not_yet_valid" | "bad_claims" };

const SKEW_SECONDS = 60;
const MAX_LIFETIME_SECONDS = 600;

function decodeJson(part: string): unknown {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function signHs256(payload: object, key: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", Buffer.from(key, "utf8")).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyEvolutionJwt(authorization: string | null, key: string, now: Date = new Date()): JwtCheck {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!match) return { ok: false, reason: "malformed" };
  const [, h, p, s] = match;

  const header = decodeJson(h) as { alg?: unknown } | null;
  if (!header || header.alg !== "HS256") return { ok: false, reason: "bad_algorithm" };

  const expected = createHmac("sha256", Buffer.from(key, "utf8")).update(`${h}.${p}`).digest();
  const given = Buffer.from(s, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: "bad_signature" };

  const payload = decodeJson(p) as { iat?: unknown; exp?: unknown; app?: unknown; action?: unknown } | null;
  if (!payload || typeof payload.iat !== "number" || typeof payload.exp !== "number") return { ok: false, reason: "malformed" };
  const nowSec = Math.floor(now.getTime() / 1000);
  if (payload.exp + SKEW_SECONDS < nowSec) return { ok: false, reason: "expired" };
  if (payload.iat - SKEW_SECONDS > nowSec) return { ok: false, reason: "not_yet_valid" };
  if (payload.exp - payload.iat > MAX_LIFETIME_SECONDS + SKEW_SECONDS) return { ok: false, reason: "bad_claims" };
  if (payload.app !== "evolution" || payload.action !== "webhook") return { ok: false, reason: "bad_claims" };
  return { ok: true };
}
