import "server-only";
import { z } from "zod";
import { withSystem, type Db } from "../db/tx";
import { AppError } from "../errors";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
  password: z.string().min(10, "A senha precisa ter pelo menos 10 caracteres.").max(200),
  organizationName: z.string().trim().min(1, "Informe o nome da organização.").max(120),
  storeName: z.string().trim().min(1, "Informe o nome da primeira loja.").max(120),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
  password: z.string().min(1, "Informe a senha.").max(200),
});

export type SignUpInput = z.input<typeof signUpSchema>;

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AppError("invalid_input", parsed.error.issues[0]?.message ?? "Dados inválidos.");
  return parsed.data;
}

/**
 * Cria usuário, organização (com o usuário como proprietário), a primeira loja,
 * os canais WhatsApp e e-mail desconectados e a configuração do agente desligada.
 */
export async function signUp(db: Db, input: SignUpInput): Promise<{ userId: string; orgId: string; storeId: string }> {
  const data = parse(signUpSchema, input);
  const passwordHash = await hashPassword(data.password);
  try {
    return await withSystem(db, async (tx) => {
      const user = await tx.query<{ id: string }>(
        "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [data.email, data.name, passwordHash],
      );
      const userId = user.rows[0].id;
      const org = await tx.query<{ id: string }>("INSERT INTO organizations (name) VALUES ($1) RETURNING id", [data.organizationName]);
      const orgId = org.rows[0].id;
      await tx.query("INSERT INTO memberships (org_id, user_id, role) VALUES ($1, $2, 'owner')", [orgId, userId]);
      const store = await tx.query<{ id: string }>("INSERT INTO stores (org_id, name) VALUES ($1, $2) RETURNING id", [orgId, data.storeName]);
      const storeId = store.rows[0].id;
      await tx.query(
        `INSERT INTO channels (org_id, store_id, kind, provider) VALUES ($1, $2, 'whatsapp', 'evolution'), ($1, $2, 'email', 'resend')`,
        [orgId, storeId],
      );
      await tx.query("INSERT INTO ai_settings (store_id, org_id) VALUES ($1, $2)", [storeId, orgId]);
      return { userId, orgId, storeId };
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") throw new AppError("email_taken", "Já existe uma conta com este e-mail.");
    throw error;
  }
}

/** Confere e-mail e senha. Mesmo tempo de resposta quando o e-mail não existe. */
export async function signIn(db: Db, input: unknown): Promise<{ userId: string }> {
  const data = parse(signInSchema, input);
  const row = await withSystem(db, async (tx) => {
    const { rows } = await tx.query<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = $1", [data.email]);
    return rows[0];
  });
  const ok = await verifyPassword(data.password, row?.password_hash ?? (await dummyPasswordHash()));
  if (!row || !ok) throw new AppError("invalid_credentials", "E-mail ou senha incorretos.");
  return { userId: row.id };
}
