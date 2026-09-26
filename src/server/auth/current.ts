import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getPool } from "../db/pool";
import { SESSION_COOKIE } from "./cookie";
import { validateSession, type SessionUser } from "./sessions";

/** Sessão da requisição atual (validada no banco), ou null. */
export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return validateSession(getPool(), store.get(SESSION_COOKIE)?.value);
});

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
