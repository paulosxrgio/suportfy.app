import "server-only";
import { withTenant, type Db, type Tx } from "../db/tx";
import { requireRole, requireStore } from "../tenancy/context";

export interface AgentSettingsView {
  storeId: string;
  enabled: boolean;
  model: string;
  dailyBudgetUsdCents: number;
  maxAiRepliesPerHour: number;
}

export async function getAgentSettings(tx: Tx, storeId: string): Promise<AgentSettingsView | null> {
  const { rows } = await tx.query<{ enabled: boolean; model: string; daily_budget_usd_cents: number; max_ai_replies_per_hour: number }>(
    "SELECT enabled, model, daily_budget_usd_cents, max_ai_replies_per_hour FROM ai_settings WHERE store_id = $1",
    [storeId],
  );
  const r = rows[0];
  return r
    ? { storeId, enabled: r.enabled, model: r.model, dailyBudgetUsdCents: r.daily_budget_usd_cents, maxAiRepliesPerHour: r.max_ai_replies_per_hour }
    : null;
}

/** Liga ou desliga o atendimento automático da loja (só administradores). */
export async function setAgentEnabled(db: Db, userId: string, storeId: string, enabled: boolean): Promise<AgentSettingsView> {
  return withTenant(db, userId, async (tx) => {
    const store = await requireStore(tx, storeId);
    await requireRole(tx, store.orgId, "admin");
    await tx.query("UPDATE ai_settings SET enabled = $2, updated_at = now() WHERE store_id = $1", [storeId, enabled]);
    return (await getAgentSettings(tx, storeId))!;
  });
}
