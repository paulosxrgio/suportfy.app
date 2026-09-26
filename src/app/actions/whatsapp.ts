"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/server/auth/current";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  testWhatsApp,
  type ConnectionDeps,
  type WhatsAppChannelView,
} from "@/server/channels/whatsapp-connection";
import { getPool } from "@/server/db/pool";
import { isBackendEnabled, serverEnv } from "@/server/env";
import { AppError } from "@/server/errors";
import { providerRequester, providerUrlOptions } from "@/server/net/provider-requester";
import { envKeyring } from "@/server/secrets/keyring";

export type WhatsAppActionState =
  | { status: "idle" }
  | { status: "done"; view: WhatsAppChannelView; message: string }
  | { status: "error"; message: string };

function deps(): ConnectionDeps {
  return {
    db: getPool(),
    keyring: envKeyring(),
    request: providerRequester(),
    publicUrl: serverEnv().SUPORTFY_PUBLIC_URL,
    urlOptions: providerUrlOptions(),
  };
}

async function requireUser(): Promise<string> {
  if (!isBackendEnabled()) throw new AppError("not_configured", "Backend não configurado neste ambiente.");
  const session = await getCurrentSession();
  if (!session) throw new AppError("unauthenticated", "Sua sessão expirou. Entre novamente.");
  return session.userId;
}

function failure(error: unknown): WhatsAppActionState {
  if (error instanceof AppError) return { status: "error", message: error.message };
  console.error("Falha na conexão do WhatsApp:", error instanceof Error ? error.name : "desconhecida");
  return { status: "error", message: "Não foi possível concluir agora. Tente novamente." };
}

function summary(view: WhatsAppChannelView): string {
  if (view.status === "connected") return "Instância conectada. O webhook foi registrado e as mensagens chegam ao agente.";
  if (view.status === "pending") return view.lastError ?? "Instância registrada, aguardando conexão com o WhatsApp.";
  if (view.status === "error") return view.lastError ?? "A conexão falhou.";
  return "Canal desconectado.";
}

/** A chave digitada vai direto para o servidor, é cifrada e nunca volta. */
export async function connectWhatsAppAction(_prev: WhatsAppActionState, formData: FormData): Promise<WhatsAppActionState> {
  try {
    const userId = await requireUser();
    const view = await connectWhatsApp(deps(), userId, {
      storeId: String(formData.get("storeId") ?? ""),
      baseUrl: String(formData.get("baseUrl") ?? ""),
      instance: String(formData.get("instance") ?? ""),
      apiKey: String(formData.get("apiKey") ?? ""),
      address: String(formData.get("address") ?? ""),
    });
    revalidatePath("/configuracoes/whatsapp");
    return { status: "done", view, message: summary(view) };
  } catch (error) {
    return failure(error);
  }
}

export async function testWhatsAppAction(storeId: string): Promise<WhatsAppActionState> {
  try {
    const view = await testWhatsApp(deps(), await requireUser(), storeId);
    revalidatePath("/configuracoes/whatsapp");
    return { status: "done", view, message: summary(view) };
  } catch (error) {
    return failure(error);
  }
}

export async function disconnectWhatsAppAction(storeId: string): Promise<WhatsAppActionState> {
  try {
    const view = await disconnectWhatsApp(deps(), await requireUser(), storeId);
    revalidatePath("/configuracoes/whatsapp");
    return { status: "done", view, message: "Canal desconectado. As chaves foram apagadas e novas respostas não serão enviadas." };
  } catch (error) {
    return failure(error);
  }
}
