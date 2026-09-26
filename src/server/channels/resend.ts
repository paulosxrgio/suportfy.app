import "server-only";
import { httpFailure, type ChannelAdapter } from "./types";

/**
 * E-mail via Resend, separado do WhatsApp. O cabeçalho Idempotency-Key faz a
 * Resend descartar reenvios da mesma mensagem. Ainda NÃO verificado com
 * credenciais reais; o recebimento (inbound) fica para a próxima etapa.
 */
export interface ResendConfig {
  apiKey: string;
  from: string;
}

export function createResendAdapter(config: ResendConfig, fetchImpl: typeof fetch = fetch): ChannelAdapter {
  return {
    kind: "email",
    async send(message) {
      try {
        const res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
            "idempotency-key": message.idempotencyKey,
          },
          body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject ?? "Atendimento", text: message.body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return httpFailure(res.status, await res.text().catch(() => ""));
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, providerMessageId: data.id ?? message.idempotencyKey };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? error.name : "erro de rede" };
      }
    },
  };
}
