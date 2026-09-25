/**
 * Formatação determinística em pt-BR.
 *
 * Os dados demonstrativos são ancorados em um "agora" fixo (`DEMO_NOW`) e no
 * fuso de São Paulo (UTC−3, sem horário de verão). Evitamos `Intl` para datas
 * para que servidor e navegador produzam exatamente o mesmo texto e não haja
 * divergência de hidratação.
 */

export const DEMO_NOW_ISO = "2026-09-25T17:30:00.000Z"; // 25/09/2026 14:30 em São Paulo
export const DEMO_NOW = Date.parse(DEMO_NOW_ISO);

const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const pageLoadedAt = Date.now();

/**
 * Relógio da demonstração: avança a partir de `DEMO_NOW` conforme o tempo real
 * passa. Use apenas em handlers de eventos (cliente) para carimbar itens novos.
 */
export function demoNowIso(): string {
  return new Date(DEMO_NOW + (Date.now() - pageLoadedAt)).toISOString();
}

/** Cria um horário demonstrativo em São Paulo: `demoTime("13:52", -1)` = ontem às 13:52. */
export function demoTime(hhmm: string, dayOffset = 0): string {
  const [h, m] = hhmm.split(":").map(Number);
  const base = new Date(DEMO_NOW + TZ_OFFSET_MS);
  const local = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dayOffset, h, m);
  return new Date(local - TZ_OFFSET_MS).toISOString();
}

/** Data demonstrativa absoluta (dia/mês de 2026) em São Paulo. */
export function demoDate(day: number, month: number, hhmm = "12:00", year = 2026): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, h, m) - TZ_OFFSET_MS).toISOString();
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  weekday: number;
  dayIndex: number;
}

function parts(iso: string): LocalParts {
  const d = new Date(Date.parse(iso) + TZ_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    dayIndex: Math.floor((Date.parse(iso) + TZ_OFFSET_MS) / DAY),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

const todayIndex = () => Math.floor((DEMO_NOW + TZ_OFFSET_MS) / DAY);

export function formatClock(iso: string): string {
  const p = parts(iso);
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

export function formatDateShort(iso: string): string {
  const p = parts(iso);
  const sameYear = p.year === parts(DEMO_NOW_ISO).year;
  return sameYear ? `${p.day} ${MONTHS_SHORT[p.month]}` : `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}`;
}

export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${pad(p.day)}/${pad(p.month + 1)}/${p.year}`;
}

/** Horário compacto para listas: "14:05", "Ontem", "Seg", "23 set". */
export function formatListTime(iso: string): string {
  const p = parts(iso);
  const diff = todayIndex() - p.dayIndex;
  if (diff <= 0) return formatClock(iso);
  if (diff === 1) return "Ontem";
  if (diff < 7) return WEEKDAYS[p.weekday].slice(0, 3);
  return formatDateShort(iso);
}

/** "Hoje, 14:05", "Ontem, 09:12" ou "23 set, 16:40". */
export function formatDateTime(iso: string): string {
  const p = parts(iso);
  const diff = todayIndex() - p.dayIndex;
  if (diff <= 0) return `Hoje, ${formatClock(iso)}`;
  if (diff === 1) return `Ontem, ${formatClock(iso)}`;
  return `${formatDateShort(iso)}, ${formatClock(iso)}`;
}

/** Separador de dia na conversa: "Hoje", "Ontem", "Quarta, 23 de setembro". */
export function formatDayLabel(iso: string): string {
  const p = parts(iso);
  const diff = todayIndex() - p.dayIndex;
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return `${WEEKDAYS[p.weekday]}, ${p.day} de ${MONTHS_LONG[p.month]}`;
}

export function dayKey(iso: string): number {
  return parts(iso).dayIndex;
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  }
  const d = Math.floor(m / (60 * 24));
  return d === 1 ? "1 dia" : `${d} dias`;
}

/** Tempo relativo ao "agora" da demonstração: "agora", "há 5 min", "em 18 min". */
export function formatRelative(iso: string): string {
  const diff = DEMO_NOW - Date.parse(iso);
  const abs = Math.abs(diff);
  if (abs < MINUTE) return "agora";
  if (abs >= 7 * DAY) return formatDateShort(iso);
  // Acima de 3 horas, a precisão em minutos só atrapalha a leitura.
  const minutes = abs / MINUTE;
  const label = minutes >= 180 && minutes < 60 * 24 ? `${Math.round(minutes / 60)} h` : formatDuration(minutes);
  return diff > 0 ? `há ${label}` : `em ${label}`;
}

export function minutesFromNow(iso: string): number {
  return (Date.parse(iso) - DEMO_NOW) / MINUTE;
}

export function formatCurrency(value: number): string {
  const negative = value < 0;
  const [int, dec] = Math.abs(value).toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}R$ ${grouped},${dec}`;
}

export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Mantém apenas o final do telefone visível: "+55 11 9••••-3021". */
export function maskPhone(phone: string): string {
  if (!phone) return "";
  const match = phone.match(/^(\+\d{2}\s\d{2}\s)(\d)\d{4}-(\d{4})$/);
  if (!match) return phone.replace(/\d(?=\d{4})/g, "•");
  return `${match[1]}${match[2]}••••-${match[3]}`;
}

/** Oculta parte do usuário do e-mail: "juliana.ferreira@example.com" → "ju••••••@example.com". */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 2)}${"•".repeat(Math.max(3, Math.min(6, user.length - 2)))}@${domain}`;
}

/** Normaliza texto para busca sem acentos e sem diferenciar maiúsculas. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesQuery(query: string, ...fields: (string | undefined | null)[]): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = normalize(fields.filter(Boolean).join(" "));
  // Consultas só com dígitos e pontuação de telefone: compara apenas os dígitos.
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 4 && /^[\d\s().+#-]+$/.test(q)) {
    return haystack.replace(/\D/g, "").includes(qDigits);
  }
  return q.split(/\s+/).every((token) => haystack.includes(token.replace(/^#/, "")));
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
