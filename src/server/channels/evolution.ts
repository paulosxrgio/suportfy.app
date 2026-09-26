import "server-only";
import { z } from "zod";
import { httpFailure, type ChannelAdapter } from "./types";

/**
 * WhatsApp via Evolution API (provedor definido na interface do V4).
 * Ainda NÃO verificado contra uma instância real: o formato segue a
 * documentação pública da Evolution API v2 e precisa ser validado com
 * credenciais antes de o canal ser marcado como conectado.
 */
export interface EvolutionConfig {
  baseUrl: string;
  instance: string;
  apiKey: string;
}

export function createEvolutionAdapter(config: EvolutionConfig, fetchImpl: typeof fetch = fetch): ChannelAdapter {
  const base = config.baseUrl.replace(/\/+$/, "");
  return {
    kind: "whatsapp",
    async send(message) {
      try {
        const res = await fetchImpl(`${base}/message/sendText/${encodeURIComponent(config.instance)}`, {
          method: "POST",
          headers: { "content-type": "application/json", apikey: config.apiKey },
          body: JSON.stringify({ number: message.to.replace(/\D/g, ""), text: message.body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return httpFailure(res.status, await res.text().catch(() => ""));
        const data = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
        return { ok: true, providerMessageId: data.key?.id ?? message.idempotencyKey };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? error.name : "erro de rede" };
      }
    },
  };
}

/** Evento de mensagem recebida (messages.upsert). Campos não usados são ignorados. */
const upsertSchema = z.object({
  event: z.string(),
  data: z.object({
    key: z.object({ id: z.string().min(1), remoteJid: z.string().min(1), fromMe: z.boolean() }),
    pushName: z.string().optional(),
    message: z
      .object({
        conversation: z.string().optional(),
        extendedTextMessage: z.object({ text: z.string() }).optional(),
      })
      .partial()
      .optional(),
    messageTimestamp: z.union([z.number(), z.string()]).optional(),
  }),
});

export interface InboundWhatsApp {
  providerMessageId: string;
  from: string;
  senderName?: string;
  body: string;
}

/**
 * Interpreta o webhook. Devolve null para eventos que não são mensagens de
 * texto de clientes — incluindo as mensagens enviadas pela própria loja
 * (`fromMe`), que causariam loop se fossem respondidas.
 */
export function parseEvolutionWebhook(payload: unknown): InboundWhatsApp | null {
  const parsed = upsertSchema.safeParse(payload);
  if (!parsed.success || parsed.data.event !== "messages.upsert") return null;
  const { key, message, pushName } = parsed.data.data;
  if (key.fromMe || key.remoteJid.endsWith("@g.us")) return null;
  const body = message?.conversation ?? message?.extendedTextMessage?.text;
  if (!body?.trim()) return null;
  return { providerMessageId: key.id, from: key.remoteJid.split("@")[0].replace(/\D/g, ""), senderName: pushName, body };
}
