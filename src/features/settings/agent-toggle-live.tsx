"use client";

import { useState, useTransition } from "react";
import { setAgentEnabledAction, type AgentToggleState } from "@/app/actions/agent";
import { useBackend } from "@/components/backend-context";
import { Switch } from "@/components/ui/controls";
import { Callout, Panel } from "@/components/ui/data";

/** Liga o atendimento automático da loja (com backend). Sem fila humana: a IA responde sozinha. */
export function AgentToggleLive() {
  const backend = useBackend();
  const [result, setResult] = useState<AgentToggleState>({ status: "idle" });
  const [busy, startTransition] = useTransition();
  if (backend.mode !== "live" || !backend.agent) return null;

  const { storeId, enabled } = backend.agent;
  const storeName = backend.stores.find((s) => s.id === storeId)?.name ?? "loja";
  const canManage = backend.org?.role === "owner" || backend.org?.role === "admin";
  const missingKey = !backend.openAiKey;
  const whatsappReady = backend.whatsapp?.view.status === "connected";

  return (
    <Panel title="Atendimento automático" description={`Quando ligado, o agente responde sozinho às mensagens da loja ${storeName}.`}>
      <label className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-ink">
          {enabled ? "Ligado: o agente responde às mensagens recebidas" : "Desligado: mensagens são recebidas, mas não respondidas"}
        </span>
        <Switch
          checked={enabled}
          disabled={!canManage || busy}
          aria-label="Atendimento automático"
          onCheckedChange={(value) => startTransition(async () => setResult(await setAgentEnabledAction(storeId, value)))}
        />
      </label>
      <div aria-live="polite" className="mt-3 space-y-2 empty:hidden">
        {enabled && missingKey && (
          <Callout tone="warning" title="Falta a chave da OpenAI">
            Sem chave, o agente não responde. Salve a chave abaixo.
          </Callout>
        )}
        {enabled && !whatsappReady && (
          <Callout tone="warning" title="WhatsApp não conectado">
            As respostas ficam bloqueadas até o canal estar conectado em Configurações › WhatsApp.
          </Callout>
        )}
        {!canManage && <p className="text-xs text-ink-3">Só proprietários e administradores podem ligar ou desligar o agente.</p>}
        {result.status === "error" && <Callout tone="danger">{result.message}</Callout>}
      </div>
    </Panel>
  );
}
