"use client";

import { KeyRound, PlugZap, Trash2 } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import { removeOpenAiKeyAction, saveOpenAiKeyAction, testOpenAiKeyAction, type KeyActionState } from "@/app/actions/openai";
import { useBackend } from "@/components/backend-context";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/data";

/** Data real (não usa o "agora" fixo da demonstração), no fuso de São Paulo. */
const realDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/**
 * Chave real da OpenAI (modo com backend). O valor digitado vai direto para a
 * server action, é cifrado no servidor e nunca volta: a tela só recebe os
 * 4 últimos caracteres e a data da última alteração.
 */
export function OpenAiKeyLive() {
  const backend = useBackend();
  const id = useId();
  const [state, save, saving] = useActionState<KeyActionState, FormData>(saveOpenAiKeyAction, { status: "idle" });
  const [result, setResult] = useState<KeyActionState>({ status: "idle" });
  const [busy, startTransition] = useTransition();
  const [replacing, setReplacing] = useState(false);
  if (backend.mode !== "live") return null;

  const canManage = backend.org?.role === "owner" || backend.org?.role === "admin";
  const key = backend.openAiKey;
  const feedback = result.status !== "idle" ? result : state;
  const showForm = !key || replacing;

  const run = (action: () => Promise<KeyActionState>) =>
    startTransition(async () => {
      const r = await action();
      setResult(r);
      if (r.status === "removed") setReplacing(false);
    });

  return (
    <div className="space-y-4">
      {key && !replacing && (
        <div className="flex flex-col gap-3 rounded-lg border border-line px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-subtle text-primary-600">
              <KeyRound className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-[13px] font-medium text-ink">Chave salva e cifrada no servidor</p>
              <p className="text-xs text-ink-3">
                <span className="font-mono">sk-…{key.last4}</span> · alterada em {realDateTime.format(new Date(key.updatedAt))}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => run(testOpenAiKeyAction)}>
              <PlugZap className="size-3.5" aria-hidden />
              Testar conexão
            </Button>
            {canManage && (
              <>
                <Button size="sm" onClick={() => setReplacing(true)}>
                  Substituir
                </Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => run(removeOpenAiKeyAction)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Remover
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {showForm &&
        (canManage ? (
          <form action={save} autoComplete="off" className="space-y-1.5" onSubmit={() => setResult({ status: "idle" })}>
            <label htmlFor={id} className="text-[13px] font-medium text-ink">
              Chave da API
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={id}
                name="apiKey"
                type="password"
                required
                placeholder="Cole aqui a chave secreta da OpenAI"
                autoComplete="new-password"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                aria-describedby={`${id}-desc`}
                className="h-9 w-full flex-1 rounded-md border border-line-strong bg-surface px-3 font-mono text-[13px] text-ink placeholder:font-sans placeholder:text-ink-4 focus:border-primary-500 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-200"
              />
              <Button type="submit" variant="primary" loading={saving}>
                {saving ? "Salvando…" : "Salvar chave"}
              </Button>
              {replacing && (
                <Button type="button" variant="ghost" onClick={() => setReplacing(false)}>
                  Cancelar
                </Button>
              )}
            </div>
            <p id={`${id}-desc`} className="text-xs text-ink-3">
              A chave é cifrada no servidor e nunca é exibida de novo. Só os 4 últimos caracteres ficam visíveis.
            </p>
          </form>
        ) : (
          <Callout tone="neutral" title="Nenhuma chave configurada">
            Só proprietários e administradores da organização podem configurar a chave da OpenAI.
          </Callout>
        ))}

      <div aria-live="polite">
        {feedback.status === "saved" && <Callout tone="info" title={`Chave salva (final ${feedback.last4})`}>Use “Testar conexão” para confirmar com a OpenAI.</Callout>}
        {feedback.status === "removed" && <Callout tone="neutral" title="Chave removida">O agente não chama a OpenAI sem uma chave.</Callout>}
        {feedback.status === "valid" && <Callout tone="info" title="Conexão confirmada">{feedback.message}</Callout>}
        {(feedback.status === "invalid" || feedback.status === "error") && (
          <Callout tone="danger" title={feedback.status === "invalid" ? "Chave recusada" : "Não foi possível concluir"}>
            {feedback.message}
          </Callout>
        )}
      </div>
    </div>
  );
}
