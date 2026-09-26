import "server-only";
import { createOpenAiClient } from "../ai/openai";
import type { LlmClient } from "../ai/llm";
import { resolveChannel } from "../channels/resolve";
import { withSystem, type Db } from "../db/tx";
import type { HttpRequester } from "../net/safe-request";
import { readSecretForServerUse, type SecretKeyring } from "../secrets/service";
import { dispatchOutbox, runAgent, type AgentDeps, type AgentResult, type DispatchDeps, type DispatchSummary } from "./pipeline";

export type ProcessResult = { status: "busy" } | { status: "done"; agent: AgentResult; dispatch: DispatchSummary };

/**
 * Roda o agente e o envio de uma conversa. Um lock consultivo por conversa
 * evita que dois webhooks simultâneos (reentrega do provedor) chamem o modelo
 * duas vezes; mesmo sem o lock, a chave de idempotência impediria a segunda
 * resposta, mas o custo da chamada já teria sido gasto.
 */
export async function processConversation(
  db: Db,
  deps: AgentDeps & Pick<DispatchDeps, "resolveChannel" | "maxAttempts">,
  conversationId: string,
): Promise<ProcessResult> {
  const client = await db.connect();
  try {
    const lock = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS ok", [`conversation:${conversationId}`]);
    if (!lock.rows[0].ok) return { status: "busy" };
    try {
      const agent = await runAgent(db, deps, conversationId);
      const dispatch = await dispatchOutbox(db, { resolveChannel: deps.resolveChannel, now: deps.now, maxAttempts: deps.maxAttempts, conversationId });
      return { status: "done", agent, dispatch };
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [`conversation:${conversationId}`]);
    }
  } finally {
    client.release();
  }
}

/** Cliente OpenAI da loja (chave da loja, ou da organização), ou null sem chave. */
export function openAiForStore(db: Db, keyring: SecretKeyring): AgentDeps["getLlm"] {
  return async ({ orgId, storeId }): Promise<LlmClient | null> => {
    const key = await withSystem(db, (tx) => readSecretForServerUse(tx, keyring, { orgId, storeId, kind: "openai_api_key" }));
    return key ? createOpenAiClient(key) : null;
  };
}

export function channelResolver(keyring: SecretKeyring, request: HttpRequester): DispatchDeps["resolveChannel"] {
  return (tx, channelId) => resolveChannel(tx, keyring, channelId, request);
}
