import "server-only";

/**
 * Preço estimado por 1 milhão de tokens, em dólares. Usado só pela trava de
 * orçamento, que precisa ser conservadora. REVISAR com a tabela oficial da
 * OpenAI antes de ativar o agente em produção.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
};
/** Modelo desconhecido: assume o mais caro, para errar a favor do orçamento. */
const FALLBACK = { input: 2.5, output: 15 };

export function estimateCostUsdMicros(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? FALLBACK;
  return Math.ceil(inputTokens * p.input + outputTokens * p.output);
}

export const ALLOWED_MODELS = Object.keys(PRICES);
