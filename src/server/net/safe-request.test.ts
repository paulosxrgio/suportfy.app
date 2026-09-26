import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertSafeUrl, createSafeRequester, guardedLookup, isBlockedAddress } from "./safe-request";

describe("proteção contra SSRF", () => {
  it("bloqueia endereços internos, reservados e mapeados", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("recusa URLs inseguras antes de qualquer conexão", () => {
    expect(() => assertSafeUrl("http://evolution.example.com")).toThrow(/https/);
    expect(() => assertSafeUrl("https://127.0.0.1:8080")).toThrow(/internos/);
    expect(() => assertSafeUrl("https://[::1]/")).toThrow(/internos/);
    expect(() => assertSafeUrl("https://localhost")).toThrow(/internos/);
    expect(() => assertSafeUrl("https://metadata.internal")).toThrow(/internos/);
    expect(() => assertSafeUrl("https://user:senha@evolution.example.com")).toThrow(/usuário ou senha/);
    expect(() => assertSafeUrl("https://intranet")).toThrow(/domínio completo/);
    expect(() => assertSafeUrl("nao é url")).toThrow(/inválido/);
    expect(assertSafeUrl("https://evolution.example.com/api").host).toBe("evolution.example.com");
  });

  it("confere o IP na hora da conexão (DNS rebinding)", async () => {
    const lookup = guardedLookup(async () => [{ address: "169.254.169.254", family: 4 }]);
    const error = await new Promise<Error | null>((resolve) => lookup("evolution.example.com", {}, (err) => resolve(err)));
    expect(error?.message).toMatch(/rede interna/);
    const ok = guardedLookup(async () => [{ address: "93.184.216.34", family: 4 }]);
    const address = await new Promise<string>((resolve) => ok("evolution.example.com", {}, (_err, addr) => resolve(addr as string)));
    expect(address).toBe("93.184.216.34");
  });

  describe("requisições reais a um servidor local", () => {
    let server: http.Server;
    let port = 0;
    beforeAll(async () => {
      server = http.createServer((req, res) => {
        if (req.url === "/redirect") {
          res.writeHead(302, { location: "http://169.254.169.254/" });
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      port = (server.address() as AddressInfo).port;
    });
    afterAll(() => new Promise<void>((r) => server.close(() => r())));

    it("sem a flag de desenvolvimento, rede interna é recusada", async () => {
      await expect(createSafeRequester()({ url: `https://127.0.0.1:${port}/`, method: "GET" })).rejects.toThrow(/internos/);
    });

    it("com a flag (só fora de produção), fala com o servidor local e não segue redirecionamentos", async () => {
      const request = createSafeRequester({ allowPrivateNetwork: true });
      expect(await request({ url: `http://127.0.0.1:${port}/`, method: "GET" })).toEqual({ status: 200, body: '{"ok":true}' });
      expect((await request({ url: `http://127.0.0.1:${port}/redirect`, method: "GET" })).status).toBe(302);
    });
  });
});
