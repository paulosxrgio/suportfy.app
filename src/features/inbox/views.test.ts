import { describe, expect, it } from "vitest";
import { conversationHref, conversationPath, parseInboxPath, viewPath } from "./views";

describe("rotas da Inbox", () => {
  it("interpreta todos os canais e cada canal", () => {
    expect(parseInboxPath(undefined)).toEqual({ view: { kind: "todas" } });
    expect(parseInboxPath(["whatsapp"])).toEqual({ view: { kind: "canal", channel: "whatsapp" } });
    expect(parseInboxPath(["email"])).toEqual({ view: { kind: "canal", channel: "email" } });
  });

  it("abre a conversa dentro do canal", () => {
    expect(parseInboxPath(["whatsapp", "conversa", "cv-01"])).toEqual({ view: { kind: "canal", channel: "whatsapp" }, conversationId: "cv-01" });
    expect(parseInboxPath(["conversa", "cv-01"])).toEqual({ view: { kind: "todas" }, conversationId: "cv-01" });
  });

  it("mantém os links antigos /inbox/<id>", () => {
    expect(parseInboxPath(["cv-07"])).toEqual({ view: { kind: "todas" }, conversationId: "cv-07" });
  });

  it("recusa rotas inexistentes", () => {
    expect(parseInboxPath(["whatsapp", "nao-lidas"])).toBeNull();
    expect(parseInboxPath(["sms", "conversa", "cv-01"])).toBeNull();
    expect(parseInboxPath(["conversa", "cv-01", "extra"])).toBeNull();
  });

  it("gera caminhos que voltam ao mesmo canal", () => {
    const views = [{ kind: "todas" }, { kind: "canal", channel: "email" }, { kind: "canal", channel: "whatsapp" }] as const;
    for (const view of views) {
      expect(parseInboxPath(conversationPath(view, "cv-03").split("/").slice(2))).toEqual({ view, conversationId: "cv-03" });
      expect(parseInboxPath(viewPath(view).split("/").slice(2))).toEqual({ view });
    }
    expect(conversationHref({ id: "cv-02", channel: "email" })).toBe("/inbox/email/conversa/cv-02");
  });
});
