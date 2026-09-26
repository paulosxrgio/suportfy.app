import "server-only";
import { agentReplySchema, type AgentReply } from "./llm";
import { extractOrderRefs, type AgentContext } from "./context";

export type ValidationIssue =
  | "invalid_json"
  | "invalid_shape"
  | "empty_reply"
  | "too_long"
  | "unknown_order"
  | "unknown_tracking_code"
  | "unexpected_link"
  | "repeated_reply";

export type ValidationResult = { ok: true; reply: AgentReply } | { ok: false; issue: ValidationIssue; detail?: string };

const TRACKING = /\b[A-Z]{2}\d{9}[A-Z]{2}\b/g;
const LINK = /https?:\/\/[^\s)]+/gi;

/**
 * Confere a resposta do modelo contra o contexto antes de ela ser enfileirada.
 * "Nunca inventar" vira regra verificável: pedidos, códigos de rastreio e links
 * citados precisam existir nos dados da loja.
 */
export function validateAgentReply(raw: string, ctx: AgentContext, opts: { maxChars: number; lastAiReply: string | null }): ValidationResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, issue: "invalid_json" };
  }
  const parsed = agentReplySchema.safeParse(json);
  if (!parsed.success) return { ok: false, issue: "invalid_shape" };
  const reply = { ...parsed.data, reply: parsed.data.reply.trim() };
  if (!reply.reply) return { ok: false, issue: "empty_reply" };
  if (reply.reply.length > opts.maxChars) return { ok: false, issue: "too_long" };

  const known = new Set(ctx.orders.map((o) => o.number.toUpperCase()));
  const cited = new Set([...reply.referenced_orders.map((n) => `#${n.replace(/^#/, "").toUpperCase()}`), ...extractOrderRefs(reply.reply, { requireHash: true })]);
  for (const n of cited) if (!known.has(n)) return { ok: false, issue: "unknown_order", detail: n };

  const knownTracking = new Set(ctx.orders.map((o) => o.tracking?.code?.toUpperCase()).filter(Boolean));
  for (const code of reply.reply.toUpperCase().match(TRACKING) ?? []) {
    if (!knownTracking.has(code)) return { ok: false, issue: "unknown_tracking_code", detail: code };
  }

  const knownLinks = new Set(ctx.orders.map((o) => o.tracking?.url).filter(Boolean));
  for (const link of reply.reply.match(LINK) ?? []) {
    if (!knownLinks.has(link)) return { ok: false, issue: "unexpected_link", detail: link };
  }

  if (opts.lastAiReply && opts.lastAiReply.trim().toLowerCase() === reply.reply.toLowerCase()) {
    return { ok: false, issue: "repeated_reply" };
  }
  return { ok: true, reply };
}
