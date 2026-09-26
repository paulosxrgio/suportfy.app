"use client";

import { PlugZap, RefreshCw, Unplug } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  connectWhatsAppAction,
  disconnectWhatsAppAction,
  testWhatsAppAction,
  type WhatsAppActionState,
} from "@/app/actions/whatsapp";
import { useBackend, type LiveContext } from "@/components/backend-context";
import { IntegrationBadge, type IntegrationState } from "@/components/shared/domain";
import { Button } from "@/components/ui/button";
import { Callout, DefinitionList, Panel } from "@/components/ui/data";
import { Field, Input } from "@/components/ui/field";

/** Data real (não usa o "agora" fixo da demonstração), no fuso de São Paulo. */
const realDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

type View = NonNullable<LiveContext["whatsapp"]>["view"];

const statusToBadge: Record<View["status"], IntegrationState> = {
  disconnected: "nao_configurado",
  pending: "configuracao_necessaria",
  connected: "conectado",
  error: "erro",
};
const statusLabels: Partial<Record<IntegrationState, string>> = {
  nao_configurado: "Desconectado",
  configuracao_necessaria: "Aguardando WhatsApp",
  conectado: "Conectado",
  erro: "Erro",
};
const providerStateLabels: Record<NonNullable<View["providerState"]>, string> = {
  open: "Conectada ao WhatsApp",
  connecting: "Conectando ao WhatsApp",
  close: "Desconectada do WhatsApp",
};

function ConnectForm({ storeId, onCancel }: { storeId: string; onCancel?: () => void }) {
  const [state, action, pending] = useActionState<WhatsAppActionState, FormData>(connectWhatsAppAction, { status: "idle" });
  useEffect(() => {
    if (state.status === "done") onCancel?.();
  }, [state, onCancel]);
  return (
    <form action={action} autoComplete="off" className="space-y-4">
      <input type="hidden" name="storeId" value={storeId} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Endereço da Evolution API" description="HTTPS público da sua instalação. Redes internas são bloqueadas.">
          {(p) => <Input {...p} name="baseUrl" type="url" required placeholder="https://evolution.suaempresa.com.br" />}
        </Field>
        <Field label="Nome da instância" description="Como aparece no painel da Evolution API.">
          {(p) => <Input {...p} name="instance" required placeholder="loja-teste" />}
        </Field>
        <Field label="Chave de acesso (apikey)" description="Cifrada no servidor. Nunca é exibida de novo.">
          {(p) => (
            <Input {...p} name="apiKey" type="password" required autoComplete="new-password" spellCheck={false} data-lpignore="true" data-1p-ignore="true" />
          )}
        </Field>
        <Field label="Número do WhatsApp da loja" optional description="Com DDI e DDD. Evita responder às mensagens da própria loja.">
          {(p) => <Input {...p} name="address" inputMode="tel" placeholder="5511999990000" />}
        </Field>
      </div>
      {state.status === "error" && (
        <Callout tone="danger" title="Não foi possível conectar">
          {state.message}
        </Callout>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" loading={pending}>
          {pending ? "Conectando…" : "Conectar instância"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <p className="text-xs text-ink-3">
          Conectar consulta o estado da instância e registra o webhook assinado. Nenhuma mensagem é enviada a clientes.
        </p>
      </div>
    </form>
  );
}

export function WhatsAppLive() {
  const backend = useBackend();
  const [reconfigure, setReconfigure] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<WhatsAppActionState>({ status: "idle" });
  const [busy, startTransition] = useTransition();
  if (backend.mode !== "live") return null;
  if (!backend.whatsapp) {
    return <Callout tone="neutral" title="Nenhuma loja encontrada">Crie uma loja para conectar o WhatsApp.</Callout>;
  }

  const { storeId, view, activity } = backend.whatsapp;
  const storeName = backend.stores.find((s) => s.id === storeId)?.name ?? "Loja";
  const canManage = backend.org?.role === "owner" || backend.org?.role === "admin";
  const configured = view.status !== "disconnected";

  const run = (fn: () => Promise<WhatsAppActionState>) =>
    startTransition(async () => {
      setResult(await fn());
      setConfirming(false);
    });

  return (
    <div className="space-y-4">
      <Panel
        title="Instância da Evolution API"
        description={`Canal de WhatsApp da loja ${storeName}. O e-mail é configurado separadamente.`}
        actions={<IntegrationBadge state={statusToBadge[view.status]} labels={statusLabels} />}
      >
        {!configured || reconfigure ? (
          canManage ? (
            <ConnectForm storeId={storeId} onCancel={reconfigure ? () => setReconfigure(false) : undefined} />
          ) : (
            <Callout tone="neutral" title="Canal desconectado">
              Só proprietários e administradores da organização podem conectar o WhatsApp.
            </Callout>
          )
        ) : (
          <div className="space-y-4">
            <DefinitionList
              items={[
                { term: "Servidor", value: view.host ?? "—" },
                { term: "Instância", value: view.instance ?? "—" },
                { term: "Chave", value: view.apiKeyLast4 ? <span className="font-mono">••••{view.apiKeyLast4}</span> : "—" },
                { term: "Número da loja", value: view.address ?? "Ainda não identificado" },
                { term: "No WhatsApp", value: view.providerState ? providerStateLabels[view.providerState] : "Não verificado" },
                { term: "Última verificação", value: view.lastCheckedAt ? realDateTime.format(new Date(view.lastCheckedAt)) : "—" },
              ]}
            />
            {view.lastError && (
              <Callout tone={view.status === "error" ? "danger" : "warning"} title={view.status === "error" ? "A conexão falhou" : "Falta um passo"}>
                {view.lastError}
              </Callout>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" loading={busy} onClick={() => run(() => testWhatsAppAction(storeId))}>
                <PlugZap className="size-3.5" aria-hidden />
                Testar conexão
              </Button>
              {canManage && (
                <>
                  <Button size="sm" onClick={() => setReconfigure(true)}>
                    <RefreshCw className="size-3.5" aria-hidden />
                    Reconfigurar
                  </Button>
                  {confirming ? (
                    <>
                      <Button size="sm" variant="danger" loading={busy} onClick={() => run(() => disconnectWhatsAppAction(storeId))}>
                        Confirmar desconexão
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
                      <Unplug className="size-3.5" aria-hidden />
                      Desconectar
                    </Button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-ink-3">“Testar conexão” só consulta o estado da instância; não envia mensagem a ninguém.</p>
          </div>
        )}
        <div aria-live="polite" className="mt-3 empty:hidden">
          {result.status === "done" && <Callout tone={result.view.status === "connected" ? "info" : "neutral"}>{result.message}</Callout>}
          {result.status === "error" && <Callout tone="danger">{result.message}</Callout>}
        </div>
      </Panel>

      <Panel title="Atividade nas últimas 24 horas" description="Mensagens reais deste canal. O agente responde sozinho; não há fila humana.">
        {view.status !== "connected" && (
          <Callout tone="warning" className="mb-4" title="Canal não conectado">
            Enquanto o canal não estiver conectado, respostas da IA ficam bloqueadas e não são enviadas.
          </Callout>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Recebidas", activity.received],
            ["Enviadas", activity.sent],
            ["Na fila", activity.queued],
            ["Falharam", activity.failed],
            ["Bloqueadas", activity.blocked],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line px-3 py-2.5">
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {activity.lastAgentIssue && (
          <Callout tone="warning" className="mt-4" title="Última mensagem que o agente não respondeu">
            {activity.lastAgentIssue.reason} <span className="text-ink-3">({realDateTime.format(new Date(activity.lastAgentIssue.at))})</span>
          </Callout>
        )}
        {activity.lastFailure && (
          <Callout tone="danger" className="mt-4" title="Última falha de envio">
            {activity.lastFailure.reason} <span className="text-ink-3">({realDateTime.format(new Date(activity.lastFailure.at))})</span>
          </Callout>
        )}
      </Panel>
    </div>
  );
}
