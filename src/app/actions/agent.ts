"use server";

import { revalidatePath } from "next/cache";
import { setAgentEnabled } from "@/server/ai/settings";
import { getCurrentSession } from "@/server/auth/current";
import { getPool } from "@/server/db/pool";
import { isBackendEnabled } from "@/server/env";
import { AppError } from "@/server/errors";

export type AgentToggleState = { status: "idle" } | { status: "done"; enabled: boolean } | { status: "error"; message: string };

export async function setAgentEnabledAction(storeId: string, enabled: boolean): Promise<AgentToggleState> {
  try {
    if (!isBackendEnabled()) throw new AppError("not_configured", "Backend não configurado neste ambiente.");
    const session = await getCurrentSession();
    if (!session) throw new AppError("unauthenticated", "Sua sessão expirou. Entre novamente.");
    const view = await setAgentEnabled(getPool(), session.userId, storeId, enabled);
    revalidatePath("/configuracoes/inteligencia-artificial");
    return { status: "done", enabled: view.enabled };
  } catch (error) {
    if (error instanceof AppError) return { status: "error", message: error.message };
    console.error("Falha ao alterar o agente:", error instanceof Error ? error.name : "desconhecida");
    return { status: "error", message: "Não foi possível concluir agora. Tente novamente." };
  }
}
