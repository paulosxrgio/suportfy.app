"use client";

import {
  KeyRound,
  Lock,
  PlugZap,
  QrCode,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Wallet,
  Webhook,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { IntegrationBadge, StoreDot, type IntegrationState } from "@/components/shared/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioCard, RadioGroup, Switch } from "@/components/ui/controls";
import { Callout, EmptyState, Panel, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/menu";
import { allowedModels, type AllowedModelId } from "@/lib/ai-models";
import { stores, useDemo } from "@/lib/demo/store";
import { SaveFooter, SecretField, SectionHeader, SettingRow, StatePreview, useSessionSettings, ValidatingRow } from "../common";

function NotImplementedButton({ children, reason }: { children: React.ReactNode; reason: string }) {
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} className="focus-ring inline-flex rounded-md">
        <Button size="sm" disabled>
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}

/* ---------------------------------- OpenAI ---------------------------------- */

const openAiLabels: Partial<Record<IntegrationState, string>> = {
  nao_configurado: "Não configurada",
  validando: "Validando",
  conectado: "Conectada",
  erro: "Erro",
};

export function AiSection() {
  const { actions } = useDemo();
  const [preview, setPreview] = useState<IntegrationState>("nao_configurado");
  const form = useSessionSettings("inteligencia-artificial", "Inteligência Artificial", {
    model: "gpt-5-mini" as AllowedModelId,
    budget: "500",
    alertAt: "80",
    pauseOnBudget: true,
    rateLimit: "60",
  });

  const test = () =>
    toast.info("Teste de conexão indisponível", {
      description: "A integração com a OpenAI ainda não foi implementada. Nenhuma requisição foi feita.",
    });

  return (
    <div className="space-y-4">
      <SectionHeader slug="inteligencia-artificial" meta={<IntegrationBadge state="nao_configurado" labels={openAiLabels} />} />

      <Panel
        title="OpenAI"
        description="Conta usada pelo agente de IA para interpretar mensagens e redigir respostas."
        actions={<IntegrationBadge state={preview} demo={preview !== "nao_configurado"} labels={openAiLabels} />}
      >
        <div className="space-y-4">
          <StatePreview value={preview} onChange={setPreview} states={["nao_configurado", "validando", "conectado", "erro"]} labels={openAiLabels} />

          {preview === "nao_configurado" && (
            <SecretField
              label="Chave da API"
              placeholder="Cole aqui a chave secreta da OpenAI"
              prefixHint="sk-"
              auditTarget="Chave da OpenAI"
              description="A chave será enviada ao servidor por conexão segura e nunca ficará exposta no navegador."
            />
          )}

          {preview === "validando" && <ValidatingRow text="Validando a chave com a OpenAI… (prévia da interface)" />}

          {preview === "conectado" && (
            <div className="flex flex-col gap-3 rounded-md border border-line px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-md bg-success-50 text-success-700 ring-1 ring-success-200">
                  <KeyRound className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-ink">Chave configurada</p>
                  <p className="font-mono text-xs text-ink-3">sk-••••••••••••••••</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={test}>
                  <PlugZap className="size-3.5" aria-hidden />
                  Testar conexão
                </Button>
                <Button size="sm" onClick={() => setPreview("nao_configurado")}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Substituir
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setPreview("nao_configurado");
                    actions.log("Removeu chave (prévia, nada armazenado)", "Chave da OpenAI");
                    toast.success("Prévia: chave removida", { description: "Nenhuma chave existia de fato nesta demonstração." });
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Remover
                </Button>
              </div>
            </div>
          )}

          {preview === "erro" && (
            <Callout
              tone="danger"
              title="A OpenAI recusou a chave"
              action={
                <Button size="xs" onClick={() => setPreview("nao_configurado")}>
                  Substituir chave
                </Button>
              }
            >
              Exemplo de mensagem de erro: a chave pode ter sido revogada ou pertencer a outro projeto. O agente fica pausado até
              uma chave válida ser configurada. (Prévia da interface.)
            </Callout>
          )}

          {preview === "nao_configurado" && (
            <div className="flex items-center gap-2">
              <NotImplementedButton reason="Configure uma chave para testar. A integração ainda não foi implementada.">
                <PlugZap className="size-3.5" aria-hidden />
                Testar conexão
              </NotImplementedButton>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Como a chave será tratada">
        <ul className="grid gap-2 text-[13px] text-ink-2 md:grid-cols-2">
          {[
            "Enviada somente ao servidor, por conexão segura.",
            "Guardada criptografada e usada apenas pelo backend.",
            "Nunca exibida por completo depois de salva: só o indicador mascarado.",
            "Não fica no navegador: nada em localStorage, cookies ou código.",
            "Não aparece em logs, relatórios de erro nem em respostas da API.",
            "Pode ser substituída ou removida a qualquer momento.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <Callout tone="warning" className="mt-4">
          Nesta etapa só existe a interface. Nenhuma chave é enviada ou armazenada, e o agente não se conecta à OpenAI.
        </Callout>
      </Panel>

      <Panel title="Modelo" description="Opções permitidas pela aplicação. A escolha será validada no servidor.">
        <RadioGroup value={form.value.model} onValueChange={(v) => form.set("model", v as AllowedModelId)} className="grid gap-2" aria-label="Modelo">
          {allowedModels.map((m) => (
            <RadioCard
              key={m.id}
              value={m.id}
              title={m.label}
              badge={
                <>
                  <code className="rounded bg-subtle px-1 text-[11.5px] text-ink-3">{m.id}</code>
                  {m.id === "gpt-5-mini" && <Badge tone="primary">Recomendado</Badge>}
                </>
              }
              description={m.description}
            />
          ))}
        </RadioGroup>
      </Panel>

      <Panel title="Limites e orçamento" description="Aplicados pelo servidor quando a integração existir.">
        <div>
          <SettingRow label="Orçamento mensal" description="Valor máximo de consumo da OpenAI por mês." htmlFor="ai-budget">
            <div className="relative w-48">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-ink-3">R$</span>
              <Input id="ai-budget" inputMode="decimal" className="pl-9" value={form.value.budget} onChange={(e) => form.set("budget", e.target.value.replace(/[^\d,]/g, ""))} />
            </div>
          </SettingRow>
          <SettingRow label="Avisar ao atingir" htmlFor="ai-alert">
            <Select id="ai-alert" wrapperClassName="w-48" value={form.value.alertAt} onChange={(e) => form.set("alertAt", e.target.value)}>
              <option value="50">50% do orçamento</option>
              <option value="80">80% do orçamento</option>
              <option value="90">90% do orçamento</option>
            </Select>
          </SettingRow>
          <SettingRow label="Pausar o agente ao atingir o orçamento" description="As conversas passam a aguardar a equipe.">
            <Switch checked={form.value.pauseOnBudget} onCheckedChange={(v) => form.set("pauseOnBudget", v)} aria-label="Pausar o agente ao atingir o orçamento" />
          </SettingRow>
          <SettingRow label="Limite de requisições por minuto" htmlFor="ai-rate">
            <Input id="ai-rate" type="number" min={1} className="w-48" value={form.value.rateLimit} onChange={(e) => form.set("rateLimit", e.target.value)} />
          </SettingRow>
        </div>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>

      <Panel title="Consumo e custos">
        <EmptyState
          compact
          icon={Wallet}
          title="Sem dados de consumo"
          description="Nenhuma chamada à OpenAI foi feita. Quando houver, aqui aparecerão tokens, custo estimado por conversa e gasto do mês."
        />
      </Panel>
    </div>
  );
}

/* ---------------------------------- Shopify --------------------------------- */

export function ShopifySection() {
  const [preview, setPreview] = useState<IntegrationState>("nao_configurado");
  return (
    <div className="space-y-4">
      <SectionHeader slug="shopify" meta={<IntegrationBadge state="nao_configurado" />} />
      <Panel title="Conexão por loja" description="Cada loja é conectada separadamente com um aplicativo Shopify.">
        <StatePreview value={preview} onChange={setPreview} states={["nao_configurado", "configuracao_necessaria", "conectado"]} />
        <ul className="mt-4 divide-y divide-line">
          {stores.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <StoreDot storeId={s.id} className="size-2.5" />
                {s.name}
              </span>
              <span className="flex items-center gap-2">
                <IntegrationBadge state={preview} demo={preview !== "nao_configurado"} />
                <NotImplementedButton reason="A integração com a Shopify ainda não foi implementada.">
                  {preview === "conectado" ? "Gerenciar" : preview === "configuracao_necessaria" ? "Concluir configuração" : "Conectar"}
                </NotImplementedButton>
              </span>
            </li>
          ))}
        </ul>
        {preview === "configuracao_necessaria" && (
          <Callout tone="warning" className="mt-4">
            Exemplo: o aplicativo foi instalado, mas faltam permissões de leitura de pedidos. (Prévia da interface.)
          </Callout>
        )}
      </Panel>
      <Panel title="O que será acessado" description="Somente leitura nesta fase.">
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <Th>Permissão</Th>
                <Th>Uso</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["read_orders", "Status, pagamento, itens e histórico de pedidos"],
                ["read_fulfillments", "Envio, transportadora e rastreio"],
                ["read_customers", "Identificar o cliente e seu histórico"],
                ["read_products", "Catálogo, variantes e disponibilidade"],
              ].map(([scope, use]) => (
                <Tr key={scope}>
                  <Td>
                    <code className="text-xs text-ink">{scope}</code>
                  </Td>
                  <Td>{use}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
        <Callout tone="neutral" className="mt-4">
          Alterar pedidos, emitir reembolsos ou cancelar compras exigirá permissões de escrita e ferramentas no servidor com
          validação determinística. Nada disso está implementado.
        </Callout>
      </Panel>
    </div>
  );
}

/* --------------------------------- WhatsApp --------------------------------- */

export function WhatsAppSection() {
  const [preview, setPreview] = useState<IntegrationState>("nao_configurado");
  const form = useSessionSettings("whatsapp", "WhatsApp", { serverUrl: "", instancePrefix: "suportfy" });
  return (
    <div className="space-y-4">
      <SectionHeader slug="whatsapp" meta={<IntegrationBadge state="nao_configurado" />} />
      <Panel title="Servidor da Evolution API" description="Onde as instâncias do WhatsApp de cada loja vão rodar.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="URL do servidor" description="Endereço HTTPS da sua instalação da Evolution API.">
            {(props) => (
              <Input {...props} type="url" placeholder="https://evolution.suaempresa.com.br" value={form.value.serverUrl} onChange={(e) => form.set("serverUrl", e.target.value)} />
            )}
          </Field>
          <Field label="Prefixo das instâncias">
            {(props) => <Input {...props} value={form.value.instancePrefix} onChange={(e) => form.set("instancePrefix", e.target.value)} />}
          </Field>
        </div>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
        <div className="mt-4 border-t border-line pt-4">
          <SecretField label="Chave global da Evolution API" auditTarget="Chave da Evolution API" description="Será guardada criptografada no servidor." />
        </div>
      </Panel>
      <Panel title="Números por loja">
        <StatePreview value={preview} onChange={setPreview} states={["nao_configurado", "configuracao_necessaria", "conectado", "erro"]} />
        <ul className="mt-4 divide-y divide-line">
          {stores.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span>
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <StoreDot storeId={s.id} className="size-2.5" />
                  {s.whatsappLabel}
                </span>
                <span className="mt-0.5 block pl-4.5 text-xs text-ink-3">
                  Instância: {form.value.instancePrefix || "suportfy"}-{s.id}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <IntegrationBadge state={preview} demo={preview !== "nao_configurado"} />
                <NotImplementedButton reason="A conexão com a Evolution API ainda não foi implementada.">
                  <QrCode className="size-3.5" aria-hidden />
                  Gerar QR Code
                </NotImplementedButton>
              </span>
            </li>
          ))}
        </ul>
        {preview === "erro" && (
          <Callout tone="danger" className="mt-4" title="Instância desconectada">
            Exemplo: o celular foi desconectado do WhatsApp Web. Mensagens ficam retidas até reconectar. (Prévia da interface.)
          </Callout>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------- E-mail ---------------------------------- */

export function EmailSection() {
  const [preview, setPreview] = useState<IntegrationState>("nao_configurado");
  const form = useSessionSettings("email", "E-mail", {
    senders: Object.fromEntries(stores.map((s) => [s.id, { name: s.name, address: s.emailAddress }])) as Record<string, { name: string; address: string }>,
  });
  return (
    <div className="space-y-4">
      <SectionHeader slug="email" meta={<IntegrationBadge state="nao_configurado" />} />
      <Panel title="Envio via Resend">
        <SecretField label="Chave da API do Resend" prefixHint="re_" auditTarget="Chave do Resend" description="Usada somente pelo servidor para enviar e-mails." />
      </Panel>
      <Panel title="Remetentes por loja" description="Nome e endereço exibidos para o cliente.">
        <div className="space-y-4">
          {stores.map((s) => (
            <div key={s.id} className="grid gap-3 md:grid-cols-2">
              <Field label={`Nome · ${s.name}`}>
                {(props) => (
                  <Input
                    {...props}
                    value={form.value.senders[s.id].name}
                    onChange={(e) => form.set("senders", { ...form.value.senders, [s.id]: { ...form.value.senders[s.id], name: e.target.value } })}
                  />
                )}
              </Field>
              <Field label="Endereço">
                {(props) => (
                  <Input
                    {...props}
                    type="email"
                    value={form.value.senders[s.id].address}
                    onChange={(e) => form.set("senders", { ...form.value.senders, [s.id]: { ...form.value.senders[s.id], address: e.target.value } })}
                  />
                )}
              </Field>
            </div>
          ))}
        </div>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>
      <Panel title="Domínio e DNS" description="Registros necessários para enviar com o domínio da loja.">
        <StatePreview value={preview} onChange={setPreview} states={["nao_configurado", "configuracao_necessaria", "conectado"]} />
        {preview === "nao_configurado" ? (
          <EmptyState compact icon={Server} title="Nenhum domínio adicionado" description="Os registros SPF, DKIM e DMARC aparecerão aqui depois de adicionar o domínio no Resend." />
        ) : (
          <TableContainer className="mt-4">
            <Table className="min-w-[520px]">
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Nome</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["TXT (SPF)", "send.aurora.example"],
                  ["TXT (DKIM)", "resend._domainkey.aurora.example"],
                  ["TXT (DMARC)", "_dmarc.aurora.example"],
                ].map(([type, name]) => (
                  <Tr key={type}>
                    <Td>{type}</Td>
                    <Td>
                      <code className="text-xs">{name}</code>
                    </Td>
                    <Td>
                      <IntegrationBadge state={preview === "conectado" ? "conectado" : "configuracao_necessaria"} demo />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </Panel>
      <Panel title="Recebimento">
        <Callout tone="neutral">
          O endereço de recebimento de cada loja será gerado ao conectar. Os e-mails dos clientes poderão ser encaminhados para ele
          a partir da caixa atual.
        </Callout>
      </Panel>
    </div>
  );
}

/* --------------------------------- Webhooks --------------------------------- */

const webhookEvents = [
  { id: "conversa.criada", label: "Conversa criada" },
  { id: "conversa.encaminhada", label: "IA encaminhou para revisão" },
  { id: "conversa.resolvida", label: "Conversa resolvida" },
  { id: "ticket.atualizado", label: "Ticket atualizado" },
  { id: "agente.erro", label: "Erro no agente" },
];

export function WebhooksSection() {
  const { actions } = useDemo();
  const formId = useId();
  const [endpoints, setEndpoints] = useState<{ id: string; url: string; events: string[] }[]>([]);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["conversa.encaminhada"]);
  const [touched, setTouched] = useState(false);
  const validUrl = /^https:\/\/[^\s]+\.[^\s]+/.test(url.trim());

  return (
    <div className="space-y-4">
      <SectionHeader
        slug="webhooks"
        actions={
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <Webhook className="size-3.5" aria-hidden />
            Adicionar endpoint
          </Button>
        }
      />
      <Callout tone="warning">Nenhum evento é enviado nesta versão. Endpoints adicionados ficam apenas nesta tela.</Callout>
      <Panel title="Endpoints" bodyClassName="p-0">
        {endpoints.length === 0 ? (
          <EmptyState
            compact
            icon={Webhook}
            title="Nenhum endpoint"
            description="Adicione uma URL HTTPS para receber eventos como encaminhamentos da IA e conversas resolvidas."
          />
        ) : (
          <ul className="divide-y divide-line">
            {endpoints.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <code className="block truncate text-[13px] text-ink">{e.url}</code>
                  <span className="text-xs text-ink-3">{e.events.map((ev) => webhookEvents.find((w) => w.id === ev)?.label).join(", ")}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge>Inativo · envio não implementado</Badge>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remover ${e.url}`} onClick={() => setEndpoints((list) => list.filter((x) => x.id !== e.id))}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Assinatura dos eventos">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Cada entrega será assinada com HMAC-SHA256 no cabeçalho <code className="text-xs">X-Suportfy-Signature</code>. O segredo de
          assinatura será gerado pelo servidor e exibido uma única vez.
        </p>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Adicionar endpoint"
          footer={
            <>
              <DialogClose asChild>
                <Button size="sm" variant="ghost">
                  Cancelar
                </Button>
              </DialogClose>
              <Button size="sm" variant="primary" type="submit" form={formId}>
                Adicionar
              </Button>
            </>
          }
        >
          <form
            id={formId}
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (!validUrl || events.length === 0) return;
              setEndpoints((list) => [...list, { id: actions.newId("wh"), url: url.trim(), events }]);
              actions.log("Adicionou endpoint de webhook (inativo)", url.trim());
              toast.success("Endpoint adicionado nesta tela", { description: "Nenhum evento será enviado nesta versão." });
              setUrl("");
              setTouched(false);
              setOpen(false);
            }}
          >
            <Field label="URL" error={touched && !validUrl ? "Use uma URL HTTPS válida." : undefined}>
              {(props) => <Input {...props} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://sistema.suaempresa.com.br/webhooks/suportfy" />}
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-ink">Eventos</legend>
              <div className="space-y-1">
                {webhookEvents.map((ev) => (
                  <label key={ev.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                    <Checkbox checked={events.includes(ev.id)} onCheckedChange={(on) => setEvents(on === true ? [...events, ev.id] : events.filter((x) => x !== ev.id))} />
                    {ev.label}
                    <code className="text-xs text-ink-3">{ev.id}</code>
                  </label>
                ))}
              </div>
              {touched && events.length === 0 && <p className="mt-1 text-xs text-danger-700">Selecione ao menos um evento.</p>}
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------ API ----------------------------------- */

export function ApiSection() {
  return (
    <div className="space-y-4">
      <SectionHeader
        slug="api"
        actions={
          <NotImplementedButton reason="A API pública ainda não foi implementada.">
            <KeyRound className="size-3.5" aria-hidden />
            Criar chave de API
          </NotImplementedButton>
        }
      />
      <Panel title="Chaves de API" bodyClassName="p-0">
        <EmptyState
          compact
          icon={KeyRound}
          title="Nenhuma chave criada"
          description="As chaves permitirão integrar o Suportfy a outros sistemas. Cada chave será exibida uma única vez, com escopos e data de expiração."
        />
      </Panel>
      <Panel title="Boas práticas planejadas">
        <ul className="space-y-2 text-[13px] text-ink-2">
          {[
            "Escopos mínimos por chave (somente leitura por padrão).",
            "Expiração obrigatória e rotação sem indisponibilidade.",
            "Registro de uso por chave na auditoria.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

