"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ChannelActivity, WhatsAppChannelView } from "@/server/channels/whatsapp-connection";

/**
 * Diz à interface se ela está ligada ao backend real ("live") ou rodando só
 * com dados de demonstração ("demo"). Nunca contém segredos.
 */
export type LiveContext = {
  mode: "live";
  user: { name: string; email: string };
  org: { id: string; name: string; role: "owner" | "admin" | "member" } | null;
  stores: { id: string; name: string }[];
  channels: { storeId: string; kind: "whatsapp" | "email"; status: "disconnected" | "pending" | "connected" | "error" }[];
  openAiKey: { last4: string; updatedAt: string } | null;
  /** Canal WhatsApp da primeira loja: estado real e atividade das últimas 24 h. */
  whatsapp: { storeId: string; view: WhatsAppChannelView; activity: ChannelActivity } | null;
  /** Atendimento automático da primeira loja (começa desligado). */
  agent: { storeId: string; enabled: boolean } | null;
};

export type BackendContextValue = { mode: "demo" } | LiveContext;

const BackendContext = createContext<BackendContextValue>({ mode: "demo" });

export function BackendProvider({ value, children }: { value: BackendContextValue; children: ReactNode }) {
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): BackendContextValue {
  return useContext(BackendContext);
}
