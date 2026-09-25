import { describe, expect, it } from "vitest";
import {
  demoDate,
  demoTime,
  formatClock,
  formatCurrency,
  formatDayLabel,
  formatDuration,
  formatListTime,
  formatRelative,
  initials,
  maskEmail,
  maskPhone,
  matchesQuery,
  normalize,
} from "./format";

describe("datas da demonstração", () => {
  it("ancora os horários em São Paulo (UTC−3)", () => {
    expect(demoTime("13:52")).toBe("2026-09-25T16:52:00.000Z");
    expect(formatClock(demoTime("09:05"))).toBe("09:05");
    expect(demoDate(1, 9, "08:00")).toBe("2026-09-01T11:00:00.000Z");
  });

  it("formata horários de lista relativos ao dia da demonstração", () => {
    expect(formatListTime(demoTime("14:21"))).toBe("14:21");
    expect(formatListTime(demoTime("16:45", -1))).toBe("Ontem");
    expect(formatListTime(demoTime("10:00", -3))).toBe("Ter");
    expect(formatListTime(demoDate(12, 9))).toBe("12 set");
  });

  it("rotula separadores de dia", () => {
    expect(formatDayLabel(demoTime("10:00"))).toBe("Hoje");
    expect(formatDayLabel(demoTime("10:00", -1))).toBe("Ontem");
    expect(formatDayLabel(demoDate(23, 9))).toBe("Quarta, 23 de setembro");
  });

  it("descreve tempos relativos passados e futuros", () => {
    expect(formatRelative(demoTime("14:12"))).toBe("há 18 min");
    expect(formatRelative(demoTime("14:48"))).toBe("em 18 min");
    expect(formatRelative(demoTime("09:40"))).toBe("há 5 h");
  });

  it("formata durações", () => {
    expect(formatDuration(18)).toBe("18 min");
    expect(formatDuration(115)).toBe("1 h 55 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(60 * 24 * 3)).toBe("3 dias");
  });
});

describe("valores e dados pessoais", () => {
  it("formata moeda em reais", () => {
    expect(formatCurrency(89.9)).toBe("R$ 89,90");
    expect(formatCurrency(1234.5)).toBe("R$ 1.234,50");
    expect(formatCurrency(-49.9)).toBe("−R$ 49,90");
  });

  it("mascara telefone e e-mail", () => {
    expect(maskPhone("+55 11 95550-3021")).toBe("+55 11 9••••-3021");
    expect(maskEmail("juliana.ferreira@example.com")).toBe("ju••••••@example.com");
    expect(maskEmail("ab@example.com")).toBe("ab•••@example.com");
  });

  it("gera iniciais", () => {
    expect(initials("Marcos Vinícius Silva")).toBe("MS");
    expect(initials("Lia")).toBe("L");
  });
});

describe("busca", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(normalize("  Patrícia RAMOS ")).toBe("patricia ramos");
    expect(matchesQuery("patricia", "Patrícia Ramos")).toBe(true);
    expect(matchesQuery("ramos pat", "Patrícia Ramos")).toBe(true);
    expect(matchesQuery("souza", "Patrícia Ramos")).toBe(false);
  });

  it("compara somente dígitos em buscas por telefone ou número", () => {
    expect(matchesQuery("(11) 95550-3021", "+55 11 95550-3021")).toBe(true);
    expect(matchesQuery("3021", "+55 11 95550-3021")).toBe(true);
    expect(matchesQuery("#AU1042", "Pedido #AU1042")).toBe(true);
  });

  it("aceita consulta vazia", () => {
    expect(matchesQuery("", "qualquer")).toBe(true);
  });
});
