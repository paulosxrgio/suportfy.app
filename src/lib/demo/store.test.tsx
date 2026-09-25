// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CURRENT_USER_ID, DemoProvider, useDataset, useDemo } from "./store";

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => <DemoProvider>{children}</DemoProvider>;
  return renderHook(() => ({ demo: useDemo(), data: useDataset() }), { wrapper });
}

const find = (result: ReturnType<typeof setup>["result"], id: string) => result.current.demo.state.conversations.find((c) => c.id === id)!;

describe("ações da demonstração", () => {
  it("assumir pausa a IA na conversa e registra auditoria", () => {
    const { result } = setup();
    const auditBefore = result.current.demo.state.audit.length;
    act(() => result.current.demo.actions.assume("cv-03"));
    const c = find(result, "cv-03");
    expect(c.state).toBe("human_assigned");
    expect(c.assigneeId).toBe(CURRENT_USER_ID);
    expect(c.timeline.at(-1)).toMatchObject({ type: "event", kind: "assigned" });
    expect(result.current.demo.state.audit).toHaveLength(auditBefore + 1);
    expect(result.current.demo.state.audit[0].action).toBe("Assumiu a conversa");
  });

  it("devolver à IA volta a conduzir conforme quem falou por último", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.returnToAi("cv-01"));
    expect(find(result, "cv-01")).toMatchObject({ state: "ai_active", assigneeId: null });
    act(() => result.current.demo.actions.returnToAi("cv-07"));
    expect(find(result, "cv-07").state).toBe("ai_active");
    expect(find(result, "cv-07").error).toBeUndefined();
  });

  it("respostas da equipe e aprovações do copiloto nunca aparecem como enviadas", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.sendReply("cv-11", "Endereço atualizado."));
    const reply = find(result, "cv-11").timeline.at(-1)!;
    expect(reply).toMatchObject({ type: "message", author: "agent", delivery: "demo" });

    act(() => result.current.demo.actions.approveDraft("cv-02", "Texto revisado"));
    const c = find(result, "cv-02");
    expect(c.aiDraft).toBeUndefined();
    expect(c.state).toBe("awaiting_customer");
    expect(c.timeline.at(-1)).toMatchObject({ author: "ai", delivery: "demo", approvedBy: CURRENT_USER_ID, body: "Texto revisado" });
  });

  it("notas internas não viram mensagens", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.addNote("cv-03", "Acompanhar"));
    expect(find(result, "cv-03").timeline.at(-1)).toMatchObject({ type: "note", body: "Acompanhar" });
    expect(find(result, "cv-03").state).toBe("ai_active");
  });

  it("marcar como lida não gera nova versão do estado", () => {
    const { result } = setup();
    const before = result.current.demo.state;
    act(() => result.current.demo.actions.markRead("cv-03"));
    expect(result.current.demo.state).toBe(before);
    act(() => result.current.demo.actions.markRead("cv-01"));
    expect(find(result, "cv-01").unreadCount).toBe(0);
  });

  it("cria ticket manual com o próximo número", () => {
    const { result } = setup();
    const max = Math.max(...result.current.demo.state.conversations.map((c) => c.ticketNumber));
    let created: { ticketNumber: number; id: string } | undefined;
    act(() => {
      created = result.current.demo.actions.createTicket({
        customerId: "cu-17",
        storeId: "trilha",
        channel: "email",
        subject: "Ligação sobre garantia",
        reason: "troca",
        priority: "normal",
        description: "Cliente ligou.",
      });
    });
    expect(created!.ticketNumber).toBe(max + 1);
    expect(find(result, created!.id).timeline.at(-1)).toMatchObject({ type: "note", body: "Cliente ligou." });
  });

  it("restaurar descarta as alterações da sessão", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.resolve("cv-03"));
    act(() => result.current.demo.actions.reset());
    expect(find(result, "cv-03").state).toBe("ai_active");
  });
});

describe("recorte de dados", () => {
  it("filtra pela loja selecionada", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.setStore("trilha"));
    expect(result.current.data.conversations.every((c) => c.storeId === "trilha")).toBe(true);
    expect(result.current.data.orders.every((o) => o.storeId === "trilha")).toBe(true);
    expect(result.current.data.allConversations.length).toBeGreaterThan(result.current.data.conversations.length);
  });

  it("modo conta sem dados esvazia as listas e mantém só a pessoa proprietária", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.setDataMode("empty"));
    expect(result.current.data.conversations).toHaveLength(0);
    expect(result.current.data.orders).toHaveLength(0);
    expect(result.current.data.knowledge).toHaveLength(0);
    expect(result.current.data.members.map((m) => m.id)).toEqual([CURRENT_USER_ID]);
  });

  it("configurações salvas ficam por seção", () => {
    const { result } = setup();
    act(() => result.current.demo.actions.saveSettings("sla", "SLA", { pauseOnCustomer: false }));
    expect(result.current.demo.state.settings.sla).toEqual({ pauseOnCustomer: false });
  });
});
