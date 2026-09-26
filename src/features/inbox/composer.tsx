"use client";

import {
  Bot,
  CirclePause,
  FlaskConical,
  Lock,
  MessageSquareReply,
  Paperclip,
  RotateCcw,
  Send,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SearchField } from "@/components/shared/filters";
import { storeById } from "@/components/shared/domain";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/field";
import { Kbd } from "@/components/ui/data";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { orders } from "@/lib/demo/data";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import type { Attachment, Channel, Conversation } from "@/lib/demo/types";
import { formatDate, matchesQuery } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ComposerMode = "reply" | "note";

export interface ComposerSeed {
  mode: ComposerMode;
  text: string;
  nonce: number;
}

/** Preenche as variáveis das respostas rápidas com os dados (demonstrativos) da conversa. */
function fillVariables(body: string, conversation: Conversation, customerName: string) {
  const order = orders.find((o) => o.id === conversation.orderIds[0]);
  const values: Record<string, string> = {
    "cliente.primeiro_nome": customerName.split(" ")[0] ?? "",
    "cliente.nome": customerName,
    "pedido.numero": order?.number ?? "{{pedido.numero}}",
    "pedido.rastreio": order?.tracking?.code ?? "{{pedido.rastreio}}",
    "pedido.previsao": order?.tracking ? formatDate(order.tracking.estimatedDelivery) : "{{pedido.previsao}}",
  };
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

function QuickReplies({ conversation, onPick }: { conversation: Conversation; onPick: (text: string) => void }) {
  const { quickReplies, allCustomers } = useDataset();
  const [query, setQuery] = useState("");
  const customerName = allCustomers.find((c) => c.id === conversation.customerId)?.name ?? "";
  const list = quickReplies.filter(
    (r) => (r.storeId === "all" || r.storeId === conversation.storeId) && matchesQuery(query, r.shortcut, r.title, r.body),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="text-ink-2">
          <Zap className="size-4" aria-hidden />
          <span className="hidden sm:inline">Respostas rápidas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[min(92vw,360px)]">
        <div className="border-b border-line p-2">
          <SearchField label="Buscar resposta rápida" placeholder="Buscar por atalho ou texto" value={query} onValueChange={setQuery} autoFocus />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
          {list.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-3">Nenhuma resposta rápida encontrada.</li>}
          {list.map((r) => (
            <li key={r.id}>
              <PopoverClose asChild>
                <button
                  type="button"
                  onClick={() => onPick(fillVariables(r.body, conversation, customerName))}
                  className="focus-ring w-full rounded-md px-2.5 py-2 text-left hover:bg-subtle"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary-700">{r.shortcut}</span>
                    <span className="text-[13px] font-medium text-ink">{r.title}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-ink-3">{r.body}</span>
                </button>
              </PopoverClose>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-3 py-2 text-xs text-ink-3">Variáveis como {"{{pedido.numero}}"} são preenchidas com os dados da conversa.</p>
      </PopoverContent>
    </Popover>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function FullComposer({
  conversation,
  seed,
  onClose,
  allowReply,
}: {
  conversation: Conversation;
  seed?: ComposerSeed;
  onClose?: () => void;
  allowReply: boolean;
}) {
  const { actions } = useDemo();
  const { allCustomers } = useDataset();
  const customer = allCustomers.find((c) => c.id === conversation.customerId);
  const store = storeById(conversation.storeId);
  const [mode, setMode] = useState<ComposerMode>(allowReply ? (seed?.mode ?? "reply") : "note");
  const [text, setText] = useState(seed?.text ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [identity, setIdentity] = useState<Channel>(conversation.channel);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const identityId = useId();

  // Ao abrir a partir de "Corrigir ou complementar", leva o foco direto ao texto.
  useEffect(() => {
    if (seed) textareaRef.current?.focus();
  }, [seed]);

  const identities = useMemo(() => {
    const list: { value: Channel; label: string }[] = [];
    if (customer?.phone) list.push({ value: "whatsapp", label: `WhatsApp · ${store?.whatsappLabel ?? "Loja"}` });
    if (customer?.email) list.push({ value: "email", label: `E-mail · ${store?.emailAddress ?? ""}` });
    return list.sort((a, b) => Number(b.value === conversation.channel) - Number(a.value === conversation.channel));
  }, [customer, store, conversation.channel]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (mode === "reply") {
      actions.sendReply(conversation.id, body, attachments, identity);
      toast.success("Resposta adicionada apenas à tela", {
        description: "Demonstração: nenhuma mensagem foi enviada ao cliente.",
      });
    } else {
      actions.addNote(conversation.id, body);
      toast.success("Nota interna adicionada", { description: "Visível só para a equipe. Mantida apenas nesta sessão." });
    }
    setText("");
    setAttachments([]);
    if (mode === "note") onClose?.();
  };

  const isNote = mode === "note";

  return (
    <div
      className={cn(
        "rounded-2xl border bg-surface shadow-xs transition-colors focus-within:border-primary-500",
        isNote ? "border-note-200 bg-note-50/50 focus-within:border-note-700/40" : "border-line-strong",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line/80 px-2.5 py-2">
        <Segmented<ComposerMode>
          label="Tipo de mensagem"
          size="xs"
          value={mode}
          onValueChange={setMode}
          options={[
            {
              value: "reply",
              label: (
                <>
                  <MessageSquareReply className="size-3.5" aria-hidden />
                  Responder ao cliente
                </>
              ),
              disabled: !allowReply,
            },
            {
              value: "note",
              label: (
                <>
                  <Lock className="size-3.5" aria-hidden />
                  Nota interna
                </>
              ),
            },
          ]}
        />
        {mode === "reply" && identities.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5">
            <label htmlFor={identityId} className="text-xs text-ink-3">
              De
            </label>
            <Select
              id={identityId}
              value={identity}
              onChange={(e) => setIdentity(e.target.value as Channel)}
              className="h-7 max-w-[240px] truncate py-0 text-xs"
            >
              {identities.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        {onClose && (
          <Button size="icon-xs" variant="ghost" className="ml-auto" onClick={onClose} aria-label="Fechar compositor">
            <X className="size-4" />
          </Button>
        )}
      </div>
      <label htmlFor={`${identityId}-text`} className="sr-only">
        {isNote ? "Escrever nota interna" : "Escrever resposta ao cliente"}
      </label>
      <textarea
        id={`${identityId}-text`}
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder={
          isNote
            ? "Escreva uma nota para a equipe. O cliente não vê notas internas."
            : `Escreva para ${customer?.name.split(" ")[0] ?? "o cliente"}…`
        }
        className="block max-h-60 min-h-20 w-full resize-y bg-transparent px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-4 focus:outline-none"
      />
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pb-2">
          {attachments.map((a) => (
            <li key={a.name} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface py-1 pr-1 pl-2 text-xs text-ink-2">
              <Paperclip className="size-3 text-ink-3" aria-hidden />
              <span className="max-w-40 truncate">{a.name}</span>
              <span className="text-ink-4">{a.size}</span>
              <button
                type="button"
                onClick={() => setAttachments((list) => list.filter((x) => x.name !== a.name))}
                className="focus-ring rounded p-0.5 text-ink-4 hover:text-ink"
                aria-label={`Remover anexo ${a.name}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
        {mode === "reply" && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const kind: Attachment["kind"] = file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file";
                  setAttachments((list) => [...list.filter((a) => a.name !== file.name), { name: file.name, kind, size: formatSize(file.size) }]);
                  toast.info("Anexo apenas listado", { description: "O arquivo não é lido, enviado ou armazenado nesta demonstração." });
                }
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="ghost" className="text-ink-2" onClick={() => fileRef.current?.click()}>
              <Paperclip className="size-4" aria-hidden />
              <span className="hidden sm:inline">Anexar</span>
            </Button>
            <QuickReplies conversation={conversation} onPick={(t) => setText((prev) => (prev.trim() ? `${prev}\n${t}` : t))} />
          </>
        )}
        <span className="ml-auto hidden items-center gap-1 text-xs text-ink-4 md:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>Enter</Kbd>
        </span>
        <Button size="sm" variant={isNote ? "secondary" : "primary"} onClick={submit} disabled={!text.trim()} className="ml-auto md:ml-2">
          {isNote ? <Lock className="size-3.5" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
          {isNote ? "Adicionar nota" : "Enviar"}
        </Button>
      </div>
      {!isNote && (
        <p className="flex items-center gap-1.5 border-t border-line/80 px-3 py-1.5 text-[11.5px] text-ink-3">
          <FlaskConical className="size-3" aria-hidden />
          Demonstração: a mensagem aparece na conversa, mas não é enviada ao cliente.
        </p>
      )}
    </div>
  );
}

function DraftApproval({ conversation }: { conversation: Conversation }) {
  const { actions } = useDemo();
  const draft = conversation.aiDraft!;
  const [text, setText] = useState(draft.body);
  const id = useId();
  const edited = text.trim() !== draft.body.trim();
  return (
    <div className="rounded-2xl border border-primary-200 bg-surface shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-primary-200/70 bg-primary-50 px-3 py-2">
        <Bot className="size-4 text-primary-700" aria-hidden />
        <p className="text-[13px] font-medium text-primary-800">Resposta preparada pela IA · aguardando aprovação</p>
        <span className="text-xs text-ink-3">Modo copiloto: nada é enviado sem aprovação.</span>
      </div>
      <label htmlFor={id} className="sr-only">
        Revisar resposta da IA
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="block max-h-72 w-full resize-y bg-transparent px-3 py-2.5 text-[13.5px] leading-relaxed text-ink focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <p className="mr-auto text-xs text-ink-3">
          {draft.sources.length} {draft.sources.length === 1 ? "fonte consultada" : "fontes consultadas"}
          {edited && " · editada por você"}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            actions.discardDraft(conversation.id);
            toast.success("Rascunho descartado", { description: "Nada foi enviado ao cliente." });
          }}
        >
          Descartar
        </Button>
        {edited && (
          <Button size="sm" variant="ghost" onClick={() => setText(draft.body)}>
            <RotateCcw className="size-3.5" aria-hidden />
            Restaurar original
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          disabled={!text.trim()}
          onClick={() => {
            actions.approveDraft(conversation.id, text.trim());
            toast.success("Resposta aprovada", { description: "Demonstração: a mensagem aparece na conversa, mas não foi enviada." });
          }}
        >
          <Send className="size-3.5" aria-hidden />
          Aprovar e enviar
        </Button>
      </div>
    </div>
  );
}

/**
 * Área inferior da conversa. A intervenção humana é a exceção: enquanto a IA
 * conduz, mostramos uma barra de supervisão; o compositor completo aparece
 * quando alguém assume a conversa ou quer registrar uma nota interna.
 */
export function Composer({
  conversation,
  seed,
  onRequestTransfer,
}: {
  conversation: Conversation;
  seed?: ComposerSeed;
  onRequestTransfer: () => void;
}) {
  const { state, actions } = useDemo();
  const assignedToMe = conversation.assigneeId === CURRENT_USER_ID && conversation.state === "human_assigned";
  // O componente é remontado (key) a cada novo `seed`, então o estado inicial basta.
  const [noteOpen, setNoteOpen] = useState(seed?.mode === "note" && !assignedToMe);
  const assignee = conversation.assigneeId ? state.members.find((m) => m.id === conversation.assigneeId) : undefined;
  const resolved = conversation.state === "resolved" || conversation.state === "auto_resolved";
  const aiConducting = ["ai_active", "awaiting_customer", "awaiting_order_info"].includes(conversation.state);

  if (conversation.aiDraft) {
    return <DraftApproval key={conversation.id} conversation={conversation} />;
  }

  if (assignedToMe) {
    return <FullComposer key={conversation.id} conversation={conversation} seed={seed} allowReply />;
  }

  if (noteOpen) {
    return <FullComposer key={`${conversation.id}-note`} conversation={conversation} seed={seed} allowReply={false} onClose={() => setNoteOpen(false)} />;
  }

  const assume = () => {
    actions.assume(conversation.id);
    toast.success("Você assumiu a conversa", { description: "A IA fica pausada nesta conversa até você devolvê-la." });
  };

  let icon = <Bot className="size-4 text-primary-600" aria-hidden />;
  let title = "O agente de IA está conduzindo esta conversa.";
  let hint = "Acompanhe as respostas e intervenha apenas se necessário.";
  if (resolved) {
    icon = <UserCheck className="size-4 text-success-700" aria-hidden />;
    title = conversation.state === "auto_resolved" ? "Conversa resolvida pelo agente de IA." : "Conversa resolvida pela equipe.";
    hint = "Se o cliente voltar a escrever, a conversa é reaberta automaticamente.";
  } else if (conversation.state === "human_assigned" && assignee) {
    icon = <UserCheck className="size-4 text-ink-3" aria-hidden />;
    title = `${assignee.name} está conduzindo esta conversa.`;
    hint = "A IA está pausada nesta conversa. Você pode deixar uma nota interna.";
  } else if (conversation.state === "agent_paused") {
    icon = <CirclePause className="size-4 text-ink-3" aria-hidden />;
    title = "A IA está pausada e ninguém assumiu esta conversa.";
    hint = "Assuma para responder ou retome a IA.";
  } else if (!aiConducting) {
    icon = <UserCheck className="size-4 text-warning-700" aria-hidden />;
    title = "Esta conversa aguarda uma pessoa da equipe.";
    hint = "Assuma para responder ao cliente ou devolva à IA se não houver exceção.";
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-xs">
      <div className="flex min-w-0 grow basis-64 items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">{title}</p>
          <p className="text-xs text-ink-3">{hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setNoteOpen(true)}>
          <Lock className="size-3.5" aria-hidden />
          Nota interna
        </Button>
        {resolved ? (
          <Button
            size="sm"
            onClick={() => {
              actions.reopen(conversation.id);
              toast.success("Conversa reaberta");
            }}
          >
            Reabrir
          </Button>
        ) : (
          <>
            {!aiConducting && conversation.state !== "human_assigned" && (
              <Button size="sm" variant="ghost" onClick={onRequestTransfer}>
                Transferir
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={assume}>
              <UserCheck className="size-3.5" aria-hidden />
              {conversation.state === "human_assigned" ? "Assumir mesmo assim" : "Assumir e responder"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
