import "server-only";
import { agentReplyJsonSchema, LlmError, type LlmClient } from "./llm";

/**
 * Cliente da OpenAI (Chat Completions com saída estruturada estrita).
 * A chave vem decifrada do servidor e só existe em memória durante a chamada;
 * mensagens de erro nunca incluem a chave nem o corpo da requisição.
 */
export function createOpenAiClient(apiKey: string, fetchImpl: typeof fetch = fetch): LlmClient {
  return {
    async complete(request) {
      let res: Response;
      try {
        res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: request.model,
            messages: [{ role: "system", content: request.system }, ...request.messages],
            response_format: { type: "json_schema", json_schema: { name: "agent_reply", strict: true, schema: agentReplyJsonSchema } },
          }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        throw new LlmError(`Falha de rede com a OpenAI (${error instanceof Error ? error.name : "desconhecida"}).`, true);
      }
      if (!res.ok) {
        throw new LlmError(`OpenAI respondeu HTTP ${res.status}.`, res.status === 429 || res.status >= 500);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null; refusal?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = data.choices?.[0]?.message;
      if (!message?.content) throw new LlmError(message?.refusal ? "O modelo recusou responder." : "Resposta vazia da OpenAI.", false);
      return {
        content: message.content,
        usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
      };
    },
  };
}
