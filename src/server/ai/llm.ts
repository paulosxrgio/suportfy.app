import "server-only";
import { z } from "zod";

/** Resposta estruturada que o modelo precisa produzir. */
export const agentReplySchema = z.object({
  reply: z.string().min(1),
  /** Números de pedido citados na resposta (precisam existir no contexto). */
  referenced_orders: z.array(z.string()),
  /** true quando a IA precisa de um dado do cliente para continuar (ex.: número do pedido). */
  needs_customer_info: z.boolean(),
});
export type AgentReply = z.infer<typeof agentReplySchema>;

/** JSON Schema equivalente, enviado ao provedor (saída estruturada estrita). */
export const agentReplyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "referenced_orders", "needs_customer_info"],
  properties: {
    reply: { type: "string" },
    referenced_orders: { type: "array", items: { type: "string" } },
    needs_customer_info: { type: "boolean" },
  },
} as const;

export interface LlmRequest {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface LlmResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** Cliente de modelo. A implementação real é a da OpenAI; os testes usam um falso. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResult>;
}
