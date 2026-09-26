import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifra AES-256-GCM. O "additional authenticated data" amarra o texto cifrado
 * ao escopo (organização, loja e tipo): copiar a linha para outra organização
 * faz a decifragem falhar.
 */
export interface Sealed {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: number;
}

export function seal(plaintext: string, key: Buffer, keyVersion: number, aad: string): Sealed {
  if (key.length !== 32) throw new Error("Chave de cifragem inválida.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion };
}

export function open(sealed: Omit<Sealed, "keyVersion">, key: Buffer, aad: string): string {
  const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
}
