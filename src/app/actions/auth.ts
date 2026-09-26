"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/server/auth/current";
import { signIn, signUp } from "@/server/auth/service";
import { createSession, deleteSession } from "@/server/auth/sessions";
import { getPool } from "@/server/db/pool";
import { isBackendEnabled } from "@/server/env";
import { AppError } from "@/server/errors";

export type AuthFormState = { error?: string; fields?: Record<string, string> };

/** Só caminhos internos, para evitar redirecionamento aberto. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/visao-geral";
}

function formError(error: unknown, fields: Record<string, string>): AuthFormState {
  if (error instanceof AppError) return { error: error.message, fields };
  // Erro inesperado: mensagem genérica; detalhes ficam só no servidor, sem dados do formulário.
  console.error("Falha na autenticação:", error instanceof Error ? error.name : "desconhecida");
  return { error: "Não foi possível concluir agora. Tente novamente em instantes.", fields };
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isBackendEnabled()) return { error: "Este ambiente está em modo demonstração, sem banco de dados." };
  const email = String(formData.get("email") ?? "");
  try {
    const { userId } = await signIn(getPool(), { email, password: formData.get("password") });
    const { token, expiresAt } = await createSession(getPool(), userId);
    await setSessionCookie(token, expiresAt);
  } catch (error) {
    return formError(error, { email });
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isBackendEnabled()) return { error: "Este ambiente está em modo demonstração, sem banco de dados." };
  const fields = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    organizationName: String(formData.get("organizationName") ?? ""),
    storeName: String(formData.get("storeName") ?? ""),
  };
  try {
    const { userId } = await signUp(getPool(), { ...fields, password: String(formData.get("password") ?? "") });
    const { token, expiresAt } = await createSession(getPool(), userId);
    await setSessionCookie(token, expiresAt);
  } catch (error) {
    return formError(error, fields);
  }
  redirect("/visao-geral");
}

export async function signOutAction(): Promise<void> {
  if (isBackendEnabled()) await deleteSession(getPool(), await readSessionToken());
  await clearSessionCookie();
  redirect("/entrar");
}
