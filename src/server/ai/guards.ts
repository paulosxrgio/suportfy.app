import "server-only";

/*
 * Travas avaliadas antes de chamar o modelo. Todas são funções puras para
 * poderem ser testadas sem banco nem provedor.
 */

export type SkipReason =
  | "ai_disabled"
  | "conversation_paused"
  | "automated_message"
  | "echo_of_ai_reply"
  | "reply_limit_reached"
  | "daily_budget_exceeded"
  | "already_answered";

const AUTOMATED_PATTERNS = [
  /resposta autom[áa]tica/i,
  /mensagem autom[áa]tica/i,
  /auto[- ]?reply/i,
  /out of (the )?office/i,
  /fora do escrit[óo]rio/i,
  /n[ãa]o responda (a )?(este|esta)/i,
  /do not reply/i,
  /delivery status notification/i,
  /mail delivery (subsystem|failed)/i,
];

/** Respostas automáticas, avisos de entrega e remetentes "no-reply" não recebem resposta. */
export function isAutomatedMessage(body: string, sender?: string | null): boolean {
  if (sender && /(^|[._-])(no-?reply|mailer-daemon|postmaster)@/i.test(sender)) return true;
  return AUTOMATED_PATTERNS.some((p) => p.test(body.slice(0, 500)));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** O cliente (ou um robô do outro lado) devolveu a última resposta da IA. */
export function isEchoOfLastAiReply(inbound: string, lastAiReply: string | null): boolean {
  return Boolean(lastAiReply) && normalize(inbound) === normalize(lastAiReply!);
}

export interface GuardInput {
  aiEnabled: boolean;
  conversationAiStatus: "active" | "paused" | "error";
  latestInbound: { id: string; body: string; sender?: string | null } | null;
  /** A última mensagem recebida já tem resposta da IA? */
  latestInboundAnswered: boolean;
  lastAiReply: string | null;
  /** Respostas da IA nesta conversa na última hora (trava anti-loop). */
  aiRepliesLastHour: number;
  maxAiRepliesPerHour: number;
  spentTodayUsdMicros: number;
  dailyBudgetUsdCents: number;
}

export function evaluateGuards(g: GuardInput): SkipReason | null {
  if (!g.aiEnabled) return "ai_disabled";
  if (g.conversationAiStatus === "paused") return "conversation_paused";
  if (!g.latestInbound || g.latestInboundAnswered) return "already_answered";
  if (isAutomatedMessage(g.latestInbound.body, g.latestInbound.sender)) return "automated_message";
  if (isEchoOfLastAiReply(g.latestInbound.body, g.lastAiReply)) return "echo_of_ai_reply";
  if (g.aiRepliesLastHour >= g.maxAiRepliesPerHour) return "reply_limit_reached";
  // 1 centavo de dólar = 10.000 micro-dólares.
  if (g.spentTodayUsdMicros >= g.dailyBudgetUsdCents * 10_000) return "daily_budget_exceeded";
  return null;
}
