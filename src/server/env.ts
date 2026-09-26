import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas por schema. Nada aqui usa o
 * prefixo NEXT_PUBLIC_: nenhum valor chega ao bundle do navegador.
 *
 * Sem DATABASE_URL a aplicação roda no modo demonstração (dados fictícios em
 * memória), como antes do backend. Com DATABASE_URL, o backend é obrigatório
 * e a chave de cifragem também.
 */
const base64Key = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "precisa ser 32 bytes em base64");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  /** Chave AES-256 (32 bytes, base64) para cifrar segredos das organizações. */
  SUPORTFY_ENCRYPTION_KEY: base64Key.optional(),
  /** Versão da chave acima; permite rotação sem perder segredos antigos. */
  SUPORTFY_ENCRYPTION_KEY_VERSION: z.coerce.number().int().min(1).default(1),
  /**
   * Endereço público do app (ex.: https://app.suportfy.com.br), usado para
   * registrar o webhook nos provedores. Sem ele, não é possível conectar canais.
   */
  SUPORTFY_PUBLIC_URL: z.string().url().optional(),
  /**
   * Só desenvolvimento: permite provedores em http:// e redes internas (ex.: uma
   * Evolution API local). Ignorado quando NODE_ENV=production.
   */
  SUPORTFY_DEV_ALLOW_PRIVATE_PROVIDER_URLS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Só os nomes das variáveis inválidas: valores nunca vão para o log.
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${names}`);
  }
  if (parsed.data.DATABASE_URL && !parsed.data.SUPORTFY_ENCRYPTION_KEY) {
    throw new Error("SUPORTFY_ENCRYPTION_KEY é obrigatória quando DATABASE_URL está definida.");
  }
  cached = parsed.data;
  return cached;
}

/** O backend real está configurado neste ambiente? */
export function isBackendEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
