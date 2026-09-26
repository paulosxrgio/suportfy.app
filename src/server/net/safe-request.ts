import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

/*
 * Requisições para endereços configurados por clientes (ex.: a instância da
 * Evolution API). Protege contra SSRF:
 *
 * - só https (http apenas com a flag de desenvolvimento);
 * - sem usuário/senha na URL;
 * - o IP é conferido no momento da conexão (lookup próprio), o que também cobre
 *   DNS rebinding: não adianta o nome resolver para um IP público na validação
 *   e para 127.0.0.1 na hora do envio;
 * - redirecionamentos não são seguidos;
 * - tempo e tamanho de resposta limitados.
 */

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** Endereço interno, reservado ou de documentação (não deve receber requisições nossas). */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(address, "ipv6");
  }
  return true;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface SafeRequestOptions {
  /** Libera http e redes internas. Só para desenvolvimento local; ignorado em produção. */
  allowPrivateNetwork?: boolean;
}

function allowPrivate(opts: SafeRequestOptions): boolean {
  return Boolean(opts.allowPrivateNetwork) && process.env.NODE_ENV !== "production";
}

/** Validação sintática da URL (a checagem de IP acontece na conexão). */
export function assertSafeUrl(raw: string, opts: SafeRequestOptions = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Endereço inválido.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && allowPrivate(opts))) {
    throw new UnsafeUrlError("Use um endereço https://.");
  }
  if (url.username || url.password) throw new UnsafeUrlError("O endereço não pode conter usuário ou senha.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate(opts)) {
    if (isIP(host) && isBlockedAddress(host)) throw new UnsafeUrlError("Endereços internos ou reservados não são permitidos.");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
      throw new UnsafeUrlError("Endereços internos ou reservados não são permitidos.");
    }
    if (!host.includes(".") && !isIP(host)) throw new UnsafeUrlError("Use um nome de domínio completo.");
  }
  return url;
}

type Resolver = (hostname: string) => Promise<LookupAddress[]>;

const systemResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => dnsLookup(hostname, { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses))));

/** Lookup usado pelo socket: recusa se QUALQUER endereço resolvido for interno. */
export function guardedLookup(resolver: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname)
      .then((addresses) => {
        if (!addresses.length) throw new UnsafeUrlError("O endereço não resolveu para nenhum IP.");
        if (addresses.some((a) => isBlockedAddress(a.address))) throw new UnsafeUrlError("O endereço aponta para uma rede interna.");
        const wanted = options.family === 6 ? 6 : options.family === 4 ? 4 : 0;
        const chosen = addresses.find((a) => !wanted || a.family === wanted) ?? addresses[0];
        if (options.all) callback(null, [chosen]);
        else callback(null, chosen.address, chosen.family);
      })
      .catch((error) => callback(error as NodeJS.ErrnoException, "", 4));
  };
}

export interface HttpRequest {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
}

/** Assinatura usada pelos clientes de provedor (permite injetar um falso nos testes). */
export type HttpRequester = (request: HttpRequest) => Promise<HttpResponse>;

const MAX_RESPONSE_BYTES = 1024 * 1024;

export function createSafeRequester(opts: SafeRequestOptions = {}, resolver?: Resolver): HttpRequester {
  return (request) =>
    new Promise<HttpResponse>((resolve, reject) => {
      let url: URL;
      try {
        url = assertSafeUrl(request.url, opts);
      } catch (error) {
        reject(error);
        return;
      }
      const client = url.protocol === "https:" ? https : http;
      const req = client.request(
        url,
        {
          method: request.method,
          headers: { accept: "application/json", ...request.headers, ...(request.body ? { "content-type": "application/json" } : {}) },
          timeout: request.timeoutMs ?? 15_000,
          lookup: allowPrivate(opts) ? undefined : guardedLookup(resolver),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_RESPONSE_BYTES) {
              req.destroy(new Error("Resposta grande demais."));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error("Tempo esgotado.")));
      req.on("error", reject);
      if (request.body) req.write(request.body);
      req.end();
    });
}
