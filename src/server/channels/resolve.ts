import "server-only";
import type { Tx } from "../db/tx";
import { readSecretForServerUse, type SecretKeyring } from "../secrets/service";
import { createEvolutionAdapter } from "./evolution";
import { createResendAdapter } from "./resend";
import type { ChannelAdapter } from "./types";

export type ChannelAvailability =
  | { state: "connected"; adapter: ChannelAdapter }
  | { state: "disconnected"; reason: "channel_not_connected" | "missing_credentials" | "incomplete_config" };

/**
 * Adaptador de envio para um canal, ou o motivo de não haver um. Um canal só
 * envia quando o status é "connected" (definido pelo servidor após validar
 * credenciais) e a chave cifrada existe.
 */
export async function resolveChannel(tx: Tx, keyring: SecretKeyring, channelId: string): Promise<ChannelAvailability> {
  const { rows } = await tx.query<{ org_id: string; store_id: string; kind: string; status: string; address: string | null; config: Record<string, unknown> }>(
    "SELECT org_id, store_id, kind, status, address, config FROM channels WHERE id = $1",
    [channelId],
  );
  const ch = rows[0];
  if (!ch || ch.status !== "connected") return { state: "disconnected", reason: "channel_not_connected" };
  const scope = { orgId: ch.org_id, storeId: ch.store_id };
  if (ch.kind === "whatsapp") {
    const apiKey = await readSecretForServerUse(tx, keyring, { ...scope, kind: "evolution_api_key" });
    if (!apiKey) return { state: "disconnected", reason: "missing_credentials" };
    const baseUrl = typeof ch.config.baseUrl === "string" ? ch.config.baseUrl : null;
    const instance = typeof ch.config.instance === "string" ? ch.config.instance : null;
    if (!baseUrl || !instance) return { state: "disconnected", reason: "incomplete_config" };
    return { state: "connected", adapter: createEvolutionAdapter({ baseUrl, instance, apiKey }) };
  }
  const apiKey = await readSecretForServerUse(tx, keyring, { ...scope, kind: "resend_api_key" });
  if (!apiKey) return { state: "disconnected", reason: "missing_credentials" };
  if (!ch.address) return { state: "disconnected", reason: "incomplete_config" };
  return { state: "connected", adapter: createResendAdapter({ apiKey, from: ch.address }) };
}
