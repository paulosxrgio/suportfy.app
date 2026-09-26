import { channelLabels } from "@/lib/demo/labels";
import type { ChannelFolder, InboxView } from "@/lib/demo/selectors";
import type { Channel, Conversation } from "@/lib/demo/types";

/**
 * Rotas das visões de conversas. A conversa aberta fica "dentro" da visão
 * (`/inbox/whatsapp/nao-lidas/conversa/cv-01`), assim a lista não muda ao
 * trocar de conversa.
 */

export const CHANNELS: Channel[] = ["whatsapp", "email"];

export const channelFolders: { id: ChannelFolder; label: string; hint: string }[] = [
  { id: "todas", label: "Todas as conversas", hint: "Todas as conversas do canal" },
  { id: "nao-lidas", label: "Não lidas", hint: "Com mensagens do cliente que ninguém abriu" },
  { id: "aguardando", label: "Aguardando resposta", hint: "O cliente escreveu por último e a conversa não foi resolvida" },
  { id: "resolvidas", label: "Resolvidas", hint: "Resolvidas pela IA ou pela equipe" },
];

export const generalViews: { view: InboxView; label: string; hint: string }[] = [
  { view: { kind: "todas" }, label: "Todas", hint: "Conversas de todos os canais" },
  { view: { kind: "mencoes" }, label: "Menções", hint: "Notas internas que mencionam você" },
  { view: { kind: "participando" }, label: "Participando", hint: "Atribuídas a você ou com uma mensagem ou nota sua" },
  { view: { kind: "nao-atribuidas" }, label: "Não atribuídas", hint: "Esperam uma pessoa e ninguém da equipe assumiu" },
];

const CONVERSATION_SEGMENT = "conversa";

export function viewPath(view: InboxView): string {
  switch (view.kind) {
    case "todas":
      return "/inbox";
    case "canal":
      return view.folder === "todas" ? `/inbox/${view.channel}` : `/inbox/${view.channel}/${view.folder}`;
    default:
      return `/inbox/${view.kind}`;
  }
}

export function conversationPath(view: InboxView, id: string): string {
  return `${viewPath(view)}/${CONVERSATION_SEGMENT}/${id}`;
}

/** Link padrão para uma conversa vinda de outra página: abre na pasta do canal dela. */
export function conversationHref(conversation: Pick<Conversation, "id" | "channel">): string {
  return conversationPath({ kind: "canal", channel: conversation.channel, folder: "todas" }, conversation.id);
}

export function sameView(a: InboxView, b: InboxView): boolean {
  return viewPath(a) === viewPath(b);
}

export function viewTitle(view: InboxView): { parent?: string; label: string } {
  if (view.kind === "canal") {
    const folder = channelFolders.find((f) => f.id === view.folder)!;
    return view.folder === "todas" ? { label: channelLabels[view.channel] } : { parent: channelLabels[view.channel], label: folder.label };
  }
  const general = generalViews.find((g) => g.view.kind === view.kind)!;
  return { label: view.kind === "todas" ? "Todas as conversas" : general.label };
}

function parseView(segments: string[]): InboxView | null {
  if (segments.length === 0) return { kind: "todas" };
  const [first, second, ...rest] = segments;
  if (rest.length) return null;
  if (CHANNELS.includes(first as Channel)) {
    if (second === undefined) return { kind: "canal", channel: first as Channel, folder: "todas" };
    if (second === "todas") return null;
    const folder = channelFolders.find((f) => f.id === second);
    return folder ? { kind: "canal", channel: first as Channel, folder: folder.id } : null;
  }
  if (second !== undefined) return null;
  const general = generalViews.find((g) => g.view.kind === first && first !== "todas");
  return general ? general.view : null;
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
  // Links antigos: `/inbox/<id>` abre a conversa na visão com todos os canais.
  if (segments.length === 1) return { view: { kind: "todas" }, conversationId: decodeURIComponent(segments[0]) };
  return null;
}
