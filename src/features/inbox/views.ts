import { channelLabels } from "@/lib/demo/labels";
import type { InboxStatus, InboxView } from "@/lib/demo/selectors";
import type { Channel, Conversation } from "@/lib/demo/types";

/**
 * Rotas da Inbox. O menu lateral escolhe o canal (`/inbox/whatsapp`,
 * `/inbox/email`) ou todos (`/inbox`); a conversa abre dentro dele
 * (`/inbox/whatsapp/conversa/cv-01`), assim a lista não muda ao trocar de conversa.
 * Os recortes (não lidas, resolvidas…) ficam na própria página.
 */

export const CHANNELS: Channel[] = ["whatsapp", "email"];

/** Recortes do seletor da Inbox, em grupos. O primeiro grupo é a supervisão da IA. */
export const statusGroups: { label: string; items: { id: InboxStatus; label: string; hint: string }[] }[] = [
  {
    label: "Supervisão",
    items: [
      { id: "revisao", label: "Para revisar", hint: "Encaminhadas pela IA para uma pessoa ou com erro no agente" },
      { id: "ia", label: "Com a IA", hint: "Conduzidas pelo agente, incluindo as que aguardam o cliente" },
      { id: "equipe", label: "Com a equipe", hint: "Assumidas por uma pessoa ou com a IA pausada" },
    ],
  },
  {
    label: "Situação",
    items: [
      { id: "abertas", label: "Abertas", hint: "Tudo o que não foi resolvido" },
      { id: "nao-lidas", label: "Não lidas", hint: "Com mensagens do cliente que ninguém abriu" },
      { id: "aguardando", label: "Aguardando resposta", hint: "O cliente escreveu por último e a conversa não foi resolvida" },
      { id: "resolvidas", label: "Resolvidas", hint: "Resolvidas pela IA ou pela equipe" },
    ],
  },
  {
    label: "Você",
    items: [
      { id: "mencoes", label: "Menções", hint: "Notas internas que mencionam você" },
      { id: "participando", label: "Participando", hint: "Atribuídas a você ou com uma mensagem ou nota sua" },
      { id: "nao-atribuidas", label: "Não atribuídas", hint: "Esperam uma pessoa e ninguém da equipe assumiu" },
    ],
  },
  {
    label: "",
    items: [{ id: "todas", label: "Todas", hint: "Todas as conversas, inclusive as resolvidas" }],
  },
];

export const statusLabels = Object.fromEntries(statusGroups.flatMap((g) => g.items.map((i) => [i.id, i.label]))) as Record<
  InboxStatus,
  string
>;

const CONVERSATION_SEGMENT = "conversa";

export function viewPath(view: InboxView): string {
  return view.kind === "canal" ? `/inbox/${view.channel}` : "/inbox";
}

export function conversationPath(view: InboxView, id: string): string {
  return `${viewPath(view)}/${CONVERSATION_SEGMENT}/${id}`;
}

/** Link padrão para uma conversa vinda de outra página: abre no canal dela. */
export function conversationHref(conversation: Pick<Conversation, "id" | "channel">): string {
  return conversationPath({ kind: "canal", channel: conversation.channel }, conversation.id);
}

export function viewTitle(view: InboxView): string {
  return view.kind === "canal" ? channelLabels[view.channel] : "Todos os canais";
}

function parseView(segments: string[]): InboxView | null {
  if (segments.length === 0) return { kind: "todas" };
  if (segments.length === 1 && CHANNELS.includes(segments[0] as Channel)) return { kind: "canal", channel: segments[0] as Channel };
  return null;
}

/** Interpreta os segmentos depois de `/inbox`. `null` quando a rota não existe. */
export function parseInboxPath(slug: string[] | undefined): { view: InboxView; conversationId?: string } | null {
  const segments = slug ?? [];
  const at = segments.indexOf(CONVERSATION_SEGMENT);
  if (at >= 0) {
    if (at !== segments.length - 2) return null;
    const view = parseView(segments.slice(0, at));
    return view ? { view, conversationId: decodeURIComponent(segments[at + 1]) } : null;
  }
  const view = parseView(segments);
  if (view) return { view };
  // Links antigos: `/inbox/<id>` abre a conversa com todos os canais.
  if (segments.length === 1) return { view: { kind: "todas" }, conversationId: decodeURIComponent(segments[0]) };
  return null;
}
