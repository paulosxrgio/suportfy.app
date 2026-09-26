import "server-only";

export type ChannelKind = "whatsapp" | "email";

export interface OutboundMessage {
  /** Número (WhatsApp, só dígitos com DDI) ou e-mail do cliente. */
  to: string;
  body: string;
  subject?: string;
  /** Chave estável da mensagem; repassada ao provedor quando ele aceita. */
  idempotencyKey: string;
}

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; retryable: boolean; error: string };

/** Adaptador de envio de um provedor. Só existe para canais conectados. */
export interface ChannelAdapter {
  kind: ChannelKind;
  send(message: OutboundMessage): Promise<SendResult>;
}

/** Classifica respostas HTTP: 429 e 5xx valem nova tentativa; o resto não. */
export function httpFailure(status: number, text: string): SendResult {
  const retryable = status === 429 || status >= 500;
  return { ok: false, retryable, error: `HTTP ${status}: ${text.slice(0, 200)}` };
}
