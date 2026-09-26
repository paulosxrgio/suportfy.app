import "server-only";
import { serverEnv } from "../env";
import type { SecretKeyring } from "./service";

/** Chave de cifragem vinda do ambiente do servidor. */
export function envKeyring(): SecretKeyring {
  const env = serverEnv();
  if (!env.SUPORTFY_ENCRYPTION_KEY) throw new Error("SUPORTFY_ENCRYPTION_KEY não definida.");
  return { current: { version: env.SUPORTFY_ENCRYPTION_KEY_VERSION, key: Buffer.from(env.SUPORTFY_ENCRYPTION_KEY, "base64") } };
}
