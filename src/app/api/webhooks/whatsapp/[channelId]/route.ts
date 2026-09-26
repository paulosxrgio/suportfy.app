import { after, type NextRequest } from "next/server";
import { handleEvolutionWebhook, MAX_WEBHOOK_BYTES } from "@/server/channels/whatsapp-webhook";
import { getPool } from "@/server/db/pool";
import { isBackendEnabled } from "@/server/env";
import { channelResolver, openAiForStore, processConversation } from "@/server/messaging/process";
import { providerRequester } from "@/server/net/provider-requester";
import { envKeyring } from "@/server/secrets/keyring";

// Agente + envio rodam depois da resposta ao provedor; dá tempo para a chamada ao modelo.
export const maxDuration = 60;

/**
 * Entrada de mensagens do WhatsApp (Evolution API). Responde rápido ao
 * provedor e processa a conversa em seguida. Logs só com o resultado da
 * checagem — nunca com o corpo, que traz dados do cliente e a `apikey`.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhooks/whatsapp/[channelId]">) {
  if (!isBackendEnabled()) return Response.json({ ok: false }, { status: 404 });
  const { channelId } = await ctx.params;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BYTES) return Response.json({ ok: false }, { status: 413 });

  const db = getPool();
  const keyring = envKeyring();
  const outcome = await handleEvolutionWebhook(
    { db, keyring },
    { channelId, authorization: request.headers.get("authorization"), rawBody: await request.text() },
  );
  if (outcome.status !== 200) console.warn(`webhook whatsapp ${channelId.slice(0, 8)}: ${outcome.status} ${outcome.result}`);

  const conversationId = outcome.conversationId;
  if (conversationId) {
    after(async () => {
      try {
        const result = await processConversation(
          db,
          { getLlm: openAiForStore(db, keyring), resolveChannel: channelResolver(keyring, providerRequester()) },
          conversationId,
        );
        const summary = result.status === "busy" ? "busy" : `${result.agent.status}; enviadas ${result.dispatch.sent}, falhas ${result.dispatch.failed}, bloqueadas ${result.dispatch.blocked}`;
        console.info(`agente conversa ${conversationId.slice(0, 8)}: ${summary}`);
      } catch (error) {
        console.error(`agente conversa ${conversationId.slice(0, 8)} falhou: ${error instanceof Error ? error.name : "erro"}`);
      }
    });
  }
  return Response.json({ ok: outcome.status === 200, result: outcome.status === 200 ? outcome.result : undefined }, { status: outcome.status });
}
