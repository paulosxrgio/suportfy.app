"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/server/auth/current";
import { getPool } from "@/server/db/pool";
import { withSystem, withTenant } from "@/server/db/tx";
import { isBackendEnabled } from "@/server/env";
import { AppError } from "@/server/errors";
import { envKeyring } from "@/server/secrets/keyring";
import { deleteSecret, readSecretForServerUse, setSecret } from "@/server/secrets/service";
import { listMemberships } from "@/server/tenancy/context";

export type KeyActionState =
  | { status: "idle" }
  | { status: "saved"; last4: string }
  | { status: "removed" }
  | { status: "valid" | "invalid" | "error"; message: string };

async function currentOrg() {
  if (!isBackendEnabled()) throw new AppError("not_configured", "Backend não configurado neste ambiente.");
  const session = await getCurrentSession();
  if (!session) throw new AppError("unauthenticated", "Sua sessão expirou. Entre novamente.");
  const memberships = await withTenant(getPool(), session.userId, listMemberships);
  if (!memberships[0]) throw new AppError("forbidden", "Você não participa de nenhuma organização.");
  return { userId: session.userId, orgId: memberships[0].orgId };
}

function failure(error: unknown): KeyActionState {
  if (error instanceof AppError) return { status: "error", message: error.message };
  console.error("Falha ao gerenciar a chave da OpenAI:", error instanceof Error ? error.name : "desconhecida");
  return { status: "error", message: "Não foi possível concluir agora. Tente novamente." };
}

/** Grava a chave cifrada. O valor nunca volta para o navegador nem vai para logs. */
export async function saveOpenAiKeyAction(_prev: KeyActionState, formData: FormData): Promise<KeyActionState> {
  try {
    const { userId, orgId } = await currentOrg();
    const meta = await setSecret(getPool(), envKeyring(), userId, { orgId, kind: "openai_api_key", value: String(formData.get("apiKey") ?? "") });
    revalidatePath("/configuracoes/inteligencia-artificial");
    return { status: "saved", last4: meta.last4 };
  } catch (error) {
    return failure(error);
  }
}

export async function removeOpenAiKeyAction(): Promise<KeyActionState> {
  try {
    const { userId, orgId } = await currentOrg();
    await deleteSecret(getPool(), userId, { orgId, kind: "openai_api_key" });
    revalidatePath("/configuracoes/inteligencia-artificial");
    return { status: "removed" };
  } catch (error) {
    return failure(error);
  }
}

/** Testa a chave salva com uma chamada real e barata (lista de modelos) à OpenAI. */
export async function testOpenAiKeyAction(): Promise<KeyActionState> {
  try {
    const { orgId } = await currentOrg();
    const key = await withSystem(getPool(), async (tx) => {
      const { rows } = await tx.query<{ id: string }>("SELECT id FROM stores WHERE org_id = $1 ORDER BY created_at LIMIT 1", [orgId]);
      if (!rows[0]) return null;
      return readSecretForServerUse(tx, envKeyring(), { orgId, storeId: rows[0].id, kind: "openai_api_key" });
    });
    if (!key) return { status: "invalid", message: "Nenhuma chave salva para testar." };
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }).catch(() => null);
    if (!res) return { status: "error", message: "Não foi possível falar com a OpenAI agora." };
    if (res.status === 401) return { status: "invalid", message: "A OpenAI recusou a chave (não autorizada)." };
    if (!res.ok) return { status: "error", message: `A OpenAI respondeu com erro ${res.status}.` };
    return { status: "valid", message: "Chave aceita pela OpenAI." };
  } catch (error) {
    return failure(error);
  }
}
