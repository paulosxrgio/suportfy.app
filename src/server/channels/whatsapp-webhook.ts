import "server-only";
import { withSystem, type Db } from "../db/tx";
import { ingestInbound } from "../messaging/pipeline";
import { readSecretForServerUse, type SecretKeyring } from "../secrets/service";
import { parseEvolutionWebhook } from "./evolution";
import { verifyEvolutionJwt } from "./webhook-jwt";

/*
 * Webhook de entrada do WhatsApp (Evolution API), um endereço por canal:
 * /api/webhooks/whatsapp/{channelId}.
 *
 * Ordem das checagens (nada do corpo é usado antes de a origem ser validada):
 * 1. canal existe, é WhatsApp, não está desconectado e tem chave de webhook;
 * 2. tamanho do corpo;
 * 3. JWT HS256 assinado com a chave do canal (Authorization: Bearer …);
 * 4. JSON e formato do evento;
 * 5. a instância do evento é a instância configurada no canal.
 *
 * O corpo NUNCA vai para logs: ele traz dados do cliente e o campo `apikey`.
 */

export const MAX_WEBHOOK_BYTES = 256 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface WebhookRequest {
  channelId: string;
  authorization: string | null;
  rawBody: string;
}

export type WebhookOutcome = {
  status: 200 | 400 | 401 | 404 | 413;
  result: string;
  /** Conversa a processar depois de responder ao provedor. */
  conversationId?: string;
};

export async function handleEvolutionWebhook(deps: { db: Db; keyring: SecretKeyring; now?: () => Date }, req: WebhookRequest): Promise<WebhookOutcome> {
  const now = deps.now?.() ?? new Date();
  if (!UUID.test(req.channelId)) return { status: 404, result: "unknown_channel" };

  const channel = await withSystem(deps.db, async (tx) => {
    const { rows } = await tx.query<{ org_id: string; store_id: string; status: string; config: { instance?: string }; address: string | null }>(
      "SELECT org_id, store_id, status, config, address FROM channels WHERE id = $1 AND kind = 'whatsapp'",
      [req.channelId],
    );
    const ch = rows[0];
    if (!ch || ch.status === "disconnected" || !ch.config.instance) return null;
    const key = await readSecretForServerUse(tx, deps.keyring, { orgId: ch.org_id, storeId: ch.store_id, kind: "evolution_webhook_key" });
    return key ? { ...ch, key } : null;
  });
  // Mesma resposta para canal inexistente ou desconectado: não revela quais ids existem.
  if (!channel) return { status: 404, result: "unknown_channel" };

  if (Buffer.byteLength(req.rawBody, "utf8") > MAX_WEBHOOK_BYTES) return { status: 413, result: "too_large" };

  const auth = verifyEvolutionJwt(req.authorization, channel.key, now);
  if (!auth.ok) return { status: 401, result: `unauthorized:${auth.reason}` };

  let payload: unknown;
  try {
    payload = JSON.parse(req.rawBody);
  } catch {
    return { status: 400, result: "invalid_json" };
  }
  const event = parseEvolutionWebhook(payload);
  if (!event) return { status: 400, result: "invalid_payload" };
  if (event.instance !== channel.config.instance) return { status: 401, result: "unauthorized:instance_mismatch" };

  // Número da própria instância: usado para ignorar mensagens da loja.
  if (event.owner && !channel.address) {
    await withSystem(deps.db, (tx) => tx.query("UPDATE channels SET address = $2 WHERE id = $1 AND address IS NULL", [req.channelId, event.owner]));
  }

  if (event.type === "connection") {
    await withSystem(deps.db, (tx) =>
      tx.query(
        `UPDATE channels SET provider_state = $2, last_checked_at = $3,
           status = CASE WHEN $2 = 'open' THEN 'connected' ELSE 'pending' END,
           last_error = CASE WHEN $2 = 'open' THEN NULL ELSE 'A instância saiu do WhatsApp. Leia o QR code no painel da Evolution API.' END,
           updated_at = now()
         WHERE id = $1 AND status <> 'disconnected'`,
        [req.channelId, event.state, now],
      ),
    );
    return { status: 200, result: `connection:${event.state}` };
  }
  if (event.type === "ignored") return { status: 200, result: `ignored:${event.reason}` };

  const stored = await ingestInbound(deps.db, {
    channelId: req.channelId,
    providerMessageId: event.providerMessageId,
    from: event.from,
    senderName: event.senderName,
    body: event.body,
  });
  if (stored.status === "ignored") return { status: 200, result: `ignored:${stored.reason}` };
  // Reentrega (duplicate) também agenda o processamento: se a primeira tentativa
  // caiu antes de responder, esta completa; se já respondeu, o agente pula.
  return { status: 200, result: stored.status, conversationId: stored.conversationId };
}
