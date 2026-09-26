import "server-only";
import type { LiveContext } from "@/components/backend-context";
import type { SessionUser } from "./auth/sessions";
import { getPool } from "./db/pool";
import { withTenant } from "./db/tx";
import { listSecretMetadata } from "./secrets/service";
import { listMemberships, listStores } from "./tenancy/context";

/**
 * Dados reais enviados à interface: só o que o usuário pode ver e nunca
 * segredos (da chave da OpenAI vão apenas os 4 últimos caracteres e a data).
 */
export async function loadLiveContext(session: SessionUser): Promise<LiveContext> {
  return withTenant(getPool(), session.userId, async (tx) => {
    const memberships = await listMemberships(tx);
    const current = memberships[0];
    if (!current) {
      return { mode: "live", user: { name: session.name, email: session.email }, org: null, stores: [], channels: [], openAiKey: null };
    }
    const stores = await listStores(tx, current.orgId);
    const channels = await tx.query<{ store_id: string; kind: "whatsapp" | "email"; status: string }>(
      "SELECT store_id, kind, status FROM channels WHERE org_id = $1",
      [current.orgId],
    );
    const secret = (await listSecretMetadata(tx, current.orgId)).find((s) => s.kind === "openai_api_key" && s.storeId === null);
    return {
      mode: "live",
      user: { name: session.name, email: session.email },
      org: { id: current.orgId, name: current.orgName, role: current.role },
      stores: stores.map((s) => ({ id: s.id, name: s.name })),
      channels: channels.rows.map((c) => ({ storeId: c.store_id, kind: c.kind, status: c.status as LiveContext["channels"][number]["status"] })),
      openAiKey: secret ? { last4: secret.last4, updatedAt: secret.updatedAt.toISOString() } : null,
    };
  });
}
