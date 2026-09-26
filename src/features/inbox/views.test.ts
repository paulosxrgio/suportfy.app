import { describe, expect, it } from "vitest";
import { conversationHref, conversationPath, parseInboxPath, viewPath } from "./views";

describe("rotas das visões de conversas", () => {
  it("interpreta visões gerais e pastas de canal", () => {
    expect(parseInboxPath(undefined)).toEqual({ view: { kind: "todas" } });
    expect(parseInboxPath(["mencoes"])).toEqual({ view: { kind: "mencoes" } });
    expect(parseInboxPath(["whatsapp"])).toEqual({ view: { kind: "canal", channel: "whatsapp", folder: "todas" } });
    expect(parseInboxPath(["email", "aguardando"])).toEqual({ view: { kind: "canal", channel: "email", folder: "aguardando" } });
  });

  it("abre a conversa dentro da visão", () => {
    expect(parseInboxPath(["whatsapp", "nao-lidas", "conversa", "cv-01"])).toEqual({
      view: { kind: "canal", channel: "whatsapp", folder: "nao-lidas" },
      conversationId: "cv-01",
    });
    expect(parseInboxPath(["conversa", "cv-01"])).toEqual({ view: { kind: "todas" }, conversationId: "cv-01" });
  });

  it("mantém os links antigos /inbox/<id>", () => {
    expect(parseInboxPath(["cv-07"])).toEqual({ view: { kind: "todas" }, conversationId: "cv-07" });
  });

  it("recusa rotas inexistentes", () => {
    expect(parseInboxPath(["whatsapp", "todas"])).toBeNull();
    expect(parseInboxPath(["sms", "nao-lidas"])).toBeNull();
    expect(parseInboxPath(["mencoes", "extra"])).toBeNull();
    expect(parseInboxPath(["conversa", "cv-01", "extra"])).toBeNull();
  });

  it("gera caminhos que voltam à mesma visão", () => {
    const views = [
      { kind: "todas" },
      { kind: "participando" },
      { kind: "canal", channel: "email", folder: "todas" },
      { kind: "canal", channel: "whatsapp", folder: "resolvidas" },
    ] as const;
    for (const view of views) {
      const segments = conversationPath(view, "cv-03").split("/").slice(2);
      expect(parseInboxPath(segments)).toEqual({ view, conversationId: "cv-03" });
      expect(parseInboxPath(viewPath(view).split("/").slice(2))).toEqual({ view });
    }
    expect(conversationHref({ id: "cv-02", channel: "email" })).toBe("/inbox/email/conversa/cv-02");
  });
});
