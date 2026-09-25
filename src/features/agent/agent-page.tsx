"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Ban,
  BookOpen,
  Bot,
  CircleCheck,
  CirclePause,
  Clock3,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Play,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DemoBadge } from "@/components/shared/demo";
import { ChannelIcon, StoreDot } from "@/components/shared/domain";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  RadioCard,
  RadioGroup,
  Segmented,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/controls";
import { Callout, Panel, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { handoffCategories, stores, teams } from "@/lib/demo/data";
import { agentModeMeta, channelLabels, knowledgeStatusMeta } from "@/lib/demo/labels";
import { useDemo } from "@/lib/demo/store";
import type { AgentConfig, AgentLength, AgentMode, AgentTone, Channel } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { AgentPreview } from "./agent-preview";

const tones: { value: AgentTone; title: string; description: string }[] = [
  { value: "cordial", title: "Cordial e objetivo", description: "Próximo, sem excesso de formalidade. Vai direto ao ponto." },
  { value: "formal", title: "Formal", description: "Linguagem institucional, sem gírias. Indicado para marcas mais sóbrias." },
  { value: "descontraido", title: "Descontraído", description: "Leve e próximo, sem perder a clareza sobre pedidos e prazos." },
];

const fixedRules = [
  "Nunca inventa status de pedido, pagamento, envio, rastreamento, política, prazo ou disponibilidade.",
  "Sem uma fonte confiável, pede o dado que falta ao cliente ou encaminha para a equipe.",
  "Não executa ações com consequências a partir de texto livre do modelo.",
  "Registra o motivo de cada encaminhamento para revisão humana.",
  "Usa apenas conteúdos publicados na base de conhecimento; rascunhos nunca são consultados.",
];

const capabilities: { label: string; requirement: string }[] = [
  { label: "Receber e interpretar mensagens de WhatsApp e e-mail, com o histórico da conversa", requirement: "Requer canais e OpenAI" },
  { label: "Localizar pedidos e explicar status reais de pagamento, envio e rastreio", requirement: "Requer Shopify" },
  { label: "Responder dúvidas com base na Shopify e na base de conhecimento publicada", requirement: "Requer OpenAI" },
  { label: "Pedir dados adicionais quando necessário", requirement: "Requer OpenAI" },
  { label: "Classificar o motivo e atualizar categoria, tags, prioridade e status do ticket", requirement: "Requer OpenAI" },
  { label: "Resumir a conversa e encaminhar exceções com o motivo registrado", requirement: "Requer OpenAI" },
];

const consequentialActions = [
  { label: "Cancelar pedido", icon: Ban },
  { label: "Emitir reembolso", icon: Undo2 },
  { label: "Alterar endereço de entrega", icon: MapPin },
  { label: "Trocar produto", icon: ArrowLeftRight },
  { label: "Modificar dados da compra", icon: Pencil },
];

function Section({ title, description, children, aside }: { title: string; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return <Panel title={title} description={description} actions={aside}>{children}</Panel>;
}

function ModeSelect({ value, onChange, label }: { value: AgentMode; onChange: (m: AgentMode) => void; label: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as AgentMode)} aria-label={label} className="h-8 w-36 text-[13px]">
      <option value="auto">Automático</option>
      <option value="copilot">Copiloto</option>
      <option value="off">Desativado</option>
    </Select>
  );
}

export function AgentPage() {
  const { state, actions } = useDemo();
  const agent = state.agent;
  const [draft, setDraft] = useState<AgentConfig>(agent);
  const set = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = JSON.stringify({ ...draft, orgPaused: agent.orgPaused }) !== JSON.stringify(agent);

  const setChannel = (storeId: string, channel: Channel, patch: Partial<AgentConfig["channels"][string][Channel]>) =>
    setDraft((d) => ({
      ...d,
      channels: { ...d.channels, [storeId]: { ...d.channels[storeId], [channel]: { ...d.channels[storeId][channel], ...patch } } },
    }));

  const togglePause = () => {
    const next = !agent.orgPaused;
    actions.setOrgPaused(next);
    setDraft((d) => ({ ...d, orgPaused: next }));
    toast.success(next ? "Agente pausado em toda a organização" : "Agente retomado na organização", {
      description: "Demonstração: não há agente real em execução.",
    });
  };

  const save = () => {
    actions.updateAgent(() => ({ ...draft, orgPaused: agent.orgPaused }), { action: "Salvou configuração do agente", target: "Agente de IA" });
    toast.success("Configuração salva nesta sessão", { description: "Ela ainda não controla um agente real." });
  };

  const channelsList = stores.flatMap((s) => (["whatsapp", "email"] as Channel[]).map((ch) => draft.channels[s.id][ch]));
  const autoCount = channelsList.filter((c) => c.mode === "auto" && !c.paused).length;

  return (
    <PageContainer>
      <PageHeader
        title="Agente de IA"
        description="O agente atende os clientes diretamente dentro das regras, fontes e limites abaixo. A equipe supervisiona e assume apenas as exceções."
        meta={
          <>
            {agent.orgPaused ? (
              <Badge tone="neutral" icon={<CirclePause aria-hidden />} size="md">
                Pausado
              </Badge>
            ) : (
              <Badge tone="primary" icon={<Bot aria-hidden />} size="md">
                Automático em {autoCount} de {channelsList.length} canais
              </Badge>
            )}
            <DemoBadge label="Configuração demonstrativa" />
          </>
        }
        actions={
          <Button size="sm" variant={agent.orgPaused ? "primary" : "secondary"} onClick={togglePause}>
            {agent.orgPaused ? <Play className="size-3.5" aria-hidden /> : <CirclePause className="size-3.5" aria-hidden />}
            {agent.orgPaused ? "Retomar agente" : "Pausar em toda a organização"}
          </Button>
        }
      />

      <Callout
        tone="warning"
        className="mb-5"
        title="Esta configuração ainda não controla um agente real"
        action={
          <Button asChild size="xs">
            <Link href="/configuracoes/inteligencia-artificial">
              <KeyRound className="size-3.5" aria-hidden />
              Conectar OpenAI
            </Link>
          </Button>
        }
      >
        Nenhum modelo está conectado, nenhuma resposta é gerada e nada é enviado aos clientes. As escolhas feitas aqui ficam só
        nesta sessão do navegador.
      </Callout>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs defaultValue="operacao" className="min-w-0">
          <TabsList>
            <TabsTrigger value="operacao">Operação</TabsTrigger>
            <TabsTrigger value="comportamento">Comportamento</TabsTrigger>
            <TabsTrigger value="limites">Limites e transferências</TabsTrigger>
            <TabsTrigger value="fontes">Fontes</TabsTrigger>
          </TabsList>

          <TabsContent value="operacao" className="space-y-4 pt-4 focus:outline-none">
            <Section
              title="Modo padrão"
              description="Usado em novas lojas e canais. O modo automático é o objetivo principal do Suportfy: a IA resolve o que é permitido e só encaminha exceções."
            >
              <RadioGroup value={draft.defaultMode} onValueChange={(v) => set("defaultMode", v as AgentMode)} className="grid gap-2" aria-label="Modo padrão do agente">
                <RadioCard
                  value="auto"
                  icon={<Bot />}
                  title={agentModeMeta.auto.label}
                  badge={<Badge tone="primary">Recomendado</Badge>}
                  description={agentModeMeta.auto.description}
                />
                <RadioCard
                  value="copilot"
                  icon={<ShieldCheck />}
                  title={agentModeMeta.copilot.label}
                  badge={<Badge>Segurança e testes</Badge>}
                  description={agentModeMeta.copilot.description}
                />
                <RadioCard value="off" icon={<CirclePause />} title={agentModeMeta.off.label} description={agentModeMeta.off.description} />
              </RadioGroup>
            </Section>

            <Section
              title="Ativação por loja e canal"
              description="Defina o modo e pause o agente em canais específicos sem afetar os demais."
              aside={
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      channels: Object.fromEntries(
                        Object.entries(d.channels).map(([sid, chs]) => [
                          sid,
                          { whatsapp: { ...chs.whatsapp, mode: d.defaultMode }, email: { ...chs.email, mode: d.defaultMode } },
                        ]),
                      ),
                    }))
                  }
                >
                  Aplicar modo padrão a todos
                </Button>
              }
            >
              <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-line bg-canvas px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-ink">Organização</p>
                  <p className="text-xs text-ink-3">
                    {agent.orgPaused ? "Pausado: nenhuma loja recebe respostas automáticas." : "Ativo nas lojas e canais habilitados abaixo."}
                  </p>
                </div>
                <Button size="xs" onClick={togglePause}>
                  {agent.orgPaused ? "Retomar" : "Pausar tudo"}
                </Button>
              </div>
              <TableContainer className={cn(agent.orgPaused && "opacity-60")}>
                <Table className="min-w-[560px]">
                  <thead>
                    <tr>
                      <Th>Loja</Th>
                      {(["whatsapp", "email"] as Channel[]).map((ch) => (
                        <Th key={ch}>
                          <span className="inline-flex items-center gap-1.5">
                            <ChannelIcon channel={ch} />
                            {channelLabels[ch]}
                          </span>
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((s) => (
                      <Tr key={s.id}>
                        <Td>
                          <span className="inline-flex items-center gap-2 font-medium text-ink">
                            <StoreDot storeId={s.id} />
                            {s.name}
                          </span>
                        </Td>
                        {(["whatsapp", "email"] as Channel[]).map((ch) => {
                          const setting = draft.channels[s.id][ch];
                          return (
                            <Td key={ch} className="py-2">
                              <span className="flex items-center gap-2">
                                <ModeSelect
                                  value={setting.mode}
                                  onChange={(mode) => setChannel(s.id, ch, { mode })}
                                  label={`Modo do agente em ${s.name}, ${channelLabels[ch]}`}
                                />
                                <label className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                                  <Switch
                                    checked={!setting.paused && setting.mode !== "off"}
                                    disabled={setting.mode === "off"}
                                    onCheckedChange={(on) => setChannel(s.id, ch, { paused: !on })}
                                    aria-label={`Agente ativo em ${s.name}, ${channelLabels[ch]}`}
                                  />
                                  {setting.mode === "off" ? "Desativado" : setting.paused ? "Pausado" : "Ativo"}
                                </label>
                              </span>
                            </Td>
                          );
                        })}
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </Section>

            <Section title="Horários de atuação" description="Quando o agente responde automaticamente.">
              <RadioGroup value={draft.schedule} onValueChange={(v) => set("schedule", v as AgentConfig["schedule"])} className="grid gap-2 md:grid-cols-3" aria-label="Horários de atuação">
                <RadioCard value="sempre" icon={<Clock3 />} title="Sempre" description="24 horas, todos os dias." />
                <RadioCard value="fora_do_horario" icon={<Clock3 />} title="Fora do horário da equipe" description="A equipe atende no horário comercial." />
                <RadioCard value="personalizado" icon={<Clock3 />} title="Personalizado" description="Janelas por dia da semana e feriados." />
              </RadioGroup>
              <p className="mt-3 text-xs text-ink-3">
                O horário da equipe e os feriados ficam em{" "}
                <Link href="/configuracoes/horarios" className="focus-ring rounded font-medium text-primary-700 hover:underline">
                  Configurações › Horários
                </Link>
                .
              </p>
            </Section>
          </TabsContent>

          <TabsContent value="comportamento" className="space-y-4 pt-4 focus:outline-none">
            <Section title="Identidade" description="Como o agente se apresenta em cada loja.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nome do agente" description="Usado em todas as lojas.">
                  {(props) => <Input {...props} value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={40} />}
                </Field>
                <div />
                {stores.map((s) => (
                  <Field key={s.id} label={`Assinatura · ${s.name}`}>
                    {(props) => (
                      <Input
                        {...props}
                        value={draft.signatureByStore[s.id] ?? ""}
                        onChange={(e) => set("signatureByStore", { ...draft.signatureByStore, [s.id]: e.target.value })}
                        maxLength={60}
                      />
                    )}
                  </Field>
                ))}
              </div>
              <Callout tone="neutral" className="mt-4">
                O agente sempre se identifica como assistente virtual quando perguntado e nunca se passa por uma pessoa.
              </Callout>
            </Section>

            <Section title="Tom de voz">
              <RadioGroup value={draft.tone} onValueChange={(v) => set("tone", v as AgentTone)} className="grid gap-2 md:grid-cols-3" aria-label="Tom de voz">
                {tones.map((t) => (
                  <RadioCard key={t.value} value={t.value} title={t.title} description={t.description} />
                ))}
              </RadioGroup>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-medium text-ink">Tamanho das respostas</span>
                <Segmented<AgentLength>
                  label="Tamanho das respostas"
                  value={draft.length}
                  onValueChange={(v) => set("length", v)}
                  options={[
                    { value: "curta", label: "Curtas" },
                    { value: "media", label: "Médias" },
                    { value: "detalhada", label: "Detalhadas" },
                  ]}
                />
              </div>
            </Section>

            <Section title="Instruções" description="Orientações gerais para todas as conversas. Regras de segurança do sistema não podem ser sobrescritas.">
              <Field label="Instruções do agente" description={`${draft.instructions.length}/2000 caracteres`}>
                {(props) => (
                  <Textarea {...props} rows={7} maxLength={2000} value={draft.instructions} onChange={(e) => set("instructions", e.target.value)} />
                )}
              </Field>
            </Section>
          </TabsContent>

          <TabsContent value="limites" className="space-y-4 pt-4 focus:outline-none">
            <Section title="Regras fixas do sistema" description="Valem para todas as lojas e não podem ser desativadas.">
              <ul className="space-y-2">
                {fixedRules.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[13px] text-ink-2">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="O que o agente fará" description="Responsabilidades planejadas. Nenhuma está ativa nesta versão.">
              <ul className="divide-y divide-line">
                {capabilities.map((c) => (
                  <li key={c.label} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="flex items-start gap-2 text-[13px] text-ink-2">
                      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-ink-4" aria-hidden />
                      {c.label}
                    </span>
                    <Badge>{c.requirement}</Badge>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Ações com consequências"
              description="Sujeitas a regras e validação. Só poderão ser executadas por ferramentas controladas pelo servidor, com validações determinísticas — nunca a partir do texto livre do modelo."
            >
              <ul className="divide-y divide-line">
                {consequentialActions.map(({ label, icon: Icon }) => (
                  <li key={label} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="flex items-center gap-2 text-[13px] text-ink">
                      <Icon className="size-4 text-ink-3" aria-hidden />
                      {label}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone="warning">Sujeita a regras e validação</Badge>
                      <Badge>Não implementada</Badge>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-3">Até existirem essas ferramentas, pedidos desse tipo são sempre encaminhados para revisão humana.</p>
            </Section>

            <Section title="Transferir para uma pessoa quando" description="O agente encaminha para a fila de revisão e registra o motivo.">
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink">Categorias sempre transferidas</legend>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {handoffCategories.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[13px] text-ink hover:bg-subtle">
                      <Checkbox
                        checked={draft.handoffCategories.includes(c.id)}
                        onCheckedChange={(on) =>
                          set(
                            "handoffCategories",
                            on === true ? [...draft.handoffCategories, c.id] : draft.handoffCategories.filter((x) => x !== c.id),
                          )
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                <label className="flex items-center justify-between gap-4 text-[13px] text-ink">
                  O cliente pedir para falar com uma pessoa
                  <Switch checked={draft.handoffOnHumanRequest} onCheckedChange={(v) => set("handoffOnHumanRequest", v)} />
                </label>
                <label className="flex items-center justify-between gap-4 text-[13px] text-ink">
                  Insatisfação persistente do cliente
                  <Switch checked={draft.handoffOnNegativeSentiment} onCheckedChange={(v) => set("handoffOnNegativeSentiment", v)} />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Encaminhar após respostas sem resolução" description="Evita que a conversa se estenda sem solução.">
                    {(props) => (
                      <Input
                        {...props}
                        type="number"
                        min={2}
                        max={20}
                        value={draft.maxAutoReplies}
                        onChange={(e) => set("maxAutoReplies", Math.max(2, Math.min(20, Number(e.target.value) || 2)))}
                      />
                    )}
                  </Field>
                  <Field label="Fila de destino">
                    {(props) => (
                      <Select {...props} value={draft.handoffTeamId} onChange={(e) => set("handoffTeamId", e.target.value)}>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
              </div>
            </Section>
          </TabsContent>

          <TabsContent value="fontes" className="space-y-4 pt-4 focus:outline-none">
            <Section
              title="Base de conhecimento"
              description="Somente conteúdos publicados podem ser usados. Rascunhos e arquivados ficam indisponíveis para o agente."
              aside={
                <Button asChild size="xs" variant="ghost">
                  <Link href="/conhecimento">
                    <BookOpen className="size-3.5" aria-hidden />
                    Gerenciar conteúdos
                  </Link>
                </Button>
              }
            >
              <ul className="divide-y divide-line">
                {state.knowledge.map((k) => {
                  const published = k.status === "publicado";
                  const meta = knowledgeStatusMeta[k.status];
                  return (
                    <li key={k.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <span className={cn("block truncate text-[13px]", published ? "text-ink" : "text-ink-3")}>{k.title}</span>
                        <span className="text-xs text-ink-3">
                          {published ? `Versão ${k.version}` : "Indisponível para o agente"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {!published && <Badge tone={meta.tone}>{meta.label}</Badge>}
                        <Switch
                          checked={published && Boolean(draft.knowledgeSources[k.id])}
                          disabled={!published}
                          onCheckedChange={(on) => set("knowledgeSources", { ...draft.knowledgeSources, [k.id]: on })}
                          aria-label={`Usar “${k.title}” como fonte`}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Dados da Shopify" description="Informações que o agente poderá consultar. Requer a Shopify conectada em cada loja.">
              <div className="space-y-3">
                {(
                  [
                    ["orders", "Pedidos", "Status, pagamento, envio, rastreio e itens"],
                    ["products", "Produtos", "Catálogo, variantes e disponibilidade"],
                    ["customers", "Clientes", "Histórico de compras do contato"],
                  ] as const
                ).map(([key, label, desc]) => (
                  <label key={key} className="flex items-center justify-between gap-4">
                    <span>
                      <span className="block text-[13px] text-ink">{label}</span>
                      <span className="block text-xs text-ink-3">{desc}</span>
                    </span>
                    <Switch
                      checked={draft.shopifySources[key]}
                      onCheckedChange={(on) => set("shopifySources", { ...draft.shopifySources, [key]: on })}
                    />
                  </label>
                ))}
              </div>
              <Callout tone="neutral" className="mt-4">
                Shopify não conectada. Sem esses dados, o agente não informa status de pedidos: ele pede o número e encaminha.
              </Callout>
            </Section>
          </TabsContent>
        </Tabs>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <AgentPreview draft={draft} />
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-5 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-2">Alterações não salvas.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDraft({ ...agent })}>
                Descartar
              </Button>
              <Button size="sm" variant="primary" onClick={save}>
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
