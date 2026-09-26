"use client";

import Link from "next/link";
import { ArrowRight, Bot, BookOpen, Pencil, Plus, Tags as TagsIcon, Trash2, UserCog, Workflow, Zap, FileText } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChannelIcon, StoreDot } from "@/components/shared/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Callout, EmptyState, Panel, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { roleMeta } from "@/lib/demo/labels";
import { stores, useDataset, useDemo } from "@/lib/demo/store";
import type { MessageTemplate, QuickReply, Role, TagDefinition } from "@/lib/demo/types";
import { SaveFooter, SectionHeader, SettingRow, useSessionSettings } from "../common";

function GoTo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild size="sm">
      <Link href={href}>
        {children}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </Button>
  );
}

/* ------------------------------- Agente de IA ------------------------------- */

export function AgentSettingsSection() {
  const form = useSessionSettings("agente-ia", "Agente de IA", {
    maskPersonalData: true,
    sendAttachments: false,
    logRetentionDays: "90",
    disclose: true,
  });
  return (
    <div className="space-y-4">
      <SectionHeader slug="agente-ia" actions={<GoTo href="/agente">Modos, comportamento e fontes</GoTo>} />
      <Callout tone="info" icon={Bot}>
        Modo de operação, tom de voz, limites e transferências ficam na página do Agente de IA. Aqui estão as políticas de dados que
        valem para todas as lojas.
      </Callout>
      <Panel title="Dados enviados ao modelo">
        <SettingRow label="Mascarar dados pessoais antes de enviar ao modelo" description="CPF, cartão e endereço completo são substituídos por marcadores.">
          <Switch checked={form.value.maskPersonalData} onCheckedChange={(v) => form.set("maskPersonalData", v)} aria-label="Mascarar dados pessoais" />
        </SettingRow>
        <SettingRow label="Enviar anexos dos clientes ao modelo" description="Fotos e PDFs só serão analisados se esta opção estiver ativa.">
          <Switch checked={form.value.sendAttachments} onCheckedChange={(v) => form.set("sendAttachments", v)} aria-label="Enviar anexos ao modelo" />
        </SettingRow>
        <SettingRow label="Identificar-se como assistente virtual" description="Recomendado. O agente nunca se passa por uma pessoa.">
          <Switch checked={form.value.disclose} onCheckedChange={(v) => form.set("disclose", v)} aria-label="Identificar-se como assistente virtual" />
        </SettingRow>
        <SettingRow label="Guardar registros de decisões do agente por" htmlFor="agent-log-retention">
          <Select id="agent-log-retention" wrapperClassName="w-40" value={form.value.logRetentionDays} onChange={(e) => form.set("logRetentionDays", e.target.value)}>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="365">1 ano</option>
          </Select>
        </SettingRow>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>
    </div>
  );
}

/* ------------------------------- Conhecimento ------------------------------- */

export function KnowledgeSettingsSection() {
  const form = useSessionSettings("conhecimento", "Conhecimento", { requireReview: true, publisher: "supervisor", reviewEveryDays: "90" });
  return (
    <div className="space-y-4">
      <SectionHeader slug="conhecimento" actions={<GoTo href="/conhecimento">Gerenciar conteúdos</GoTo>} />
      <Panel title="Publicação">
        <SettingRow label="Exigir revisão antes de publicar" description="Um segundo membro aprova o conteúdo antes de ele ficar disponível para o agente.">
          <Switch checked={form.value.requireReview} onCheckedChange={(v) => form.set("requireReview", v)} aria-label="Exigir revisão antes de publicar" />
        </SettingRow>
        <SettingRow label="Quem pode publicar" htmlFor="kb-publisher">
          <Select id="kb-publisher" wrapperClassName="w-44" value={form.value.publisher} onChange={(e) => form.set("publisher", e.target.value)}>
            <option value="administrador">Administradores</option>
            <option value="supervisor">Supervisores e acima</option>
          </Select>
        </SettingRow>
        <SettingRow label="Lembrar de revisar conteúdos publicados a cada" htmlFor="kb-review">
          <Select id="kb-review" wrapperClassName="w-44" value={form.value.reviewEveryDays} onChange={(e) => form.set("reviewEveryDays", e.target.value)}>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
            <option value="180">180 dias</option>
          </Select>
        </SettingRow>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>
      <Callout tone="neutral" icon={BookOpen}>
        Rascunhos e conteúdos arquivados nunca ficam disponíveis para o agente, independentemente destas opções.
      </Callout>
    </div>
  );
}

/* -------------------------------- Automações -------------------------------- */

export function AutomationsSettingsSection() {
  const form = useSessionSettings("automacoes", "Automações", { maxRunsPerConversation: "5", allowMessages: false, notifyOnFailure: true });
  return (
    <div className="space-y-4">
      <SectionHeader slug="automacoes" actions={<GoTo href="/automacoes">Ver automações</GoTo>} />
      <Callout tone="warning" icon={Workflow}>
        Automações ainda não são executadas nesta versão.
      </Callout>
      <Panel title="Limites">
        <SettingRow label="Execuções por conversa" description="Evita laços entre regras." htmlFor="auto-max">
          <Input id="auto-max" type="number" min={1} max={20} className="w-28" value={form.value.maxRunsPerConversation} onChange={(e) => form.set("maxRunsPerConversation", e.target.value)} />
        </SettingRow>
        <SettingRow label="Permitir que automações enviem mensagens ao cliente" description="Quando desligado, regras só etiquetam, priorizam e encaminham.">
          <Switch checked={form.value.allowMessages} onCheckedChange={(v) => form.set("allowMessages", v)} aria-label="Permitir envio de mensagens por automações" />
        </SettingRow>
        <SettingRow label="Avisar supervisores quando uma regra falhar">
          <Switch checked={form.value.notifyOnFailure} onCheckedChange={(v) => form.set("notifyOnFailure", v)} aria-label="Avisar quando uma regra falhar" />
        </SettingRow>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>
      <Callout tone="neutral">Ações com consequências, como cancelar pedidos ou emitir reembolsos, não podem ser usadas em automações.</Callout>
    </div>
  );
}

/* ---------------------------- Equipe e permissões --------------------------- */

export function TeamSettingsSection() {
  const form = useSessionSettings("equipe-permissoes", "Equipe e permissões", { defaultRole: "atendente" as Role, inviteExpiresDays: "7", restrictStores: true });
  return (
    <div className="space-y-4">
      <SectionHeader slug="equipe-permissoes" actions={<GoTo href="/equipe">Membros, equipes e funções</GoTo>} />
      <Panel title="Convites e acesso">
        <SettingRow label="Função padrão de novos convites" htmlFor="team-role">
          <Select id="team-role" wrapperClassName="w-44" value={form.value.defaultRole} onChange={(e) => form.set("defaultRole", e.target.value as Role)}>
            {(["administrador", "supervisor", "atendente", "leitura"] as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleMeta[r].label}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Validade dos convites" htmlFor="team-expire">
          <Select id="team-expire" wrapperClassName="w-44" value={form.value.inviteExpiresDays} onChange={(e) => form.set("inviteExpiresDays", e.target.value)}>
            <option value="3">3 dias</option>
            <option value="7">7 dias</option>
            <option value="14">14 dias</option>
          </Select>
        </SettingRow>
        <SettingRow label="Restringir atendentes às lojas atribuídas" description="Eles não veem conversas, clientes ou pedidos de outras lojas.">
          <Switch checked={form.value.restrictStores} onCheckedChange={(v) => form.set("restrictStores", v)} aria-label="Restringir atendentes às lojas atribuídas" />
        </SettingRow>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>
      <Callout tone="warning" icon={UserCog}>
        Permissões serão aplicadas quando a autenticação for implementada.
      </Callout>
    </div>
  );
}

/* ----------------------------------- Tags ----------------------------------- */

const tagColors = ["#b02a20", "#875a00", "#b4577a", "#7a4fb4", "#c0802a", "#2563eb", "#1b6f47", "#4b5563", "#0e7490"];

export function TagsSection() {
  const { tags, allConversations } = useDataset();
  const { actions } = useDemo();
  const formId = useId();
  const [editing, setEditing] = useState<{ tag: TagDefinition; isNew: boolean } | null>(null);
  const usage = (name: string) => allConversations.filter((c) => c.tags.includes(name)).length;

  return (
    <div>
      <SectionHeader
        slug="tags"
        actions={
          <Button size="sm" variant="primary" onClick={() => setEditing({ tag: { id: actions.newId("tg"), name: "", color: tagColors[5], description: "" }, isNew: true })}>
            <Plus className="size-3.5" aria-hidden />
            Nova tag
          </Button>
        }
      />
      {tags.length === 0 ? (
        <TableContainer>
          <EmptyState compact icon={TagsIcon} title="Nenhuma tag" description="Tags ajudam a IA e a equipe a organizar conversas e relatórios." />
        </TableContainer>
      ) : (
        <TableContainer>
          <Table className="min-w-[560px]">
            <thead>
              <tr>
                <Th>Tag</Th>
                <Th>Descrição</Th>
                <Th className="text-right">Conversas</Th>
                <Th className="w-24">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <span className="inline-flex items-center gap-2 font-medium text-ink">
                      <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                      {t.name}
                    </span>
                  </Td>
                  <Td>{t.description}</Td>
                  <Td className="text-right tabular-nums">{usage(t.name)}</Td>
                  <Td>
                    <span className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Editar tag ${t.name}`} onClick={() => setEditing({ tag: t, isNew: false })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Excluir tag ${t.name}`}
                        onClick={() => {
                          actions.deleteTag(t.id);
                          toast.success(`Tag “${t.name}” excluída`, { description: "Somente nesta sessão." });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent
            size="sm"
            title={editing.isNew ? "Nova tag" : "Editar tag"}
            footer={
              <>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button size="sm" variant="primary" type="submit" form={formId} disabled={!editing.tag.name.trim()}>
                  Salvar
                </Button>
              </>
            }
          >
            <form
              id={formId}
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const name = editing.tag.name.trim().toLowerCase().replace(/\s+/g, "-");
                if (!name) return;
                actions.saveTag({ ...editing.tag, name }, editing.isNew);
                toast.success("Tag salva nesta sessão");
                setEditing(null);
              }}
            >
              <Field label="Nome" description="Letras minúsculas e hífens.">
                {(props) => <Input {...props} value={editing.tag.name} onChange={(e) => setEditing({ ...editing, tag: { ...editing.tag, name: e.target.value } })} />}
              </Field>
              <Field label="Descrição" optional>
                {(props) => <Input {...props} value={editing.tag.description} onChange={(e) => setEditing({ ...editing, tag: { ...editing.tag, description: e.target.value } })} />}
              </Field>
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-ink">Cor</legend>
                <div className="flex flex-wrap gap-2">
                  {tagColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, tag: { ...editing.tag, color: c } })}
                      aria-pressed={editing.tag.color === c}
                      aria-label={`Cor ${c}`}
                      className="focus-ring size-6 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </fieldset>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/* ----------------------------- Respostas rápidas ---------------------------- */

export function QuickRepliesSection() {
  const { quickReplies } = useDataset();
  const { actions } = useDemo();
  const formId = useId();
  const [editing, setEditing] = useState<{ reply: QuickReply; isNew: boolean } | null>(null);
  const shortcutValid = editing ? /^\/[\w-]+$/.test(editing.reply.shortcut.trim()) : true;

  return (
    <div>
      <SectionHeader
        slug="respostas-rapidas"
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() => setEditing({ reply: { id: actions.newId("qr"), shortcut: "/", title: "", body: "", storeId: "all" }, isNew: true })}
          >
            <Plus className="size-3.5" aria-hidden />
            Nova resposta
          </Button>
        }
      />
      <Callout tone="neutral" className="mb-4">
        Usadas pela equipe quando assume uma conversa. Variáveis disponíveis: {"{{cliente.primeiro_nome}}"}, {"{{cliente.nome}}"},{" "}
        {"{{pedido.numero}}"}, {"{{pedido.rastreio}}"}, {"{{pedido.previsao}}"}.
      </Callout>
      {quickReplies.length === 0 ? (
        <TableContainer>
          <EmptyState compact icon={Zap} title="Nenhuma resposta rápida" description="Crie textos prontos para as intervenções mais comuns." />
        </TableContainer>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {quickReplies.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <code className="text-xs text-primary-700">{r.shortcut}</code>
                  <span className="text-[13px] font-medium text-ink">{r.title}</span>
                  {r.storeId === "all" ? (
                    <Badge>Todas as lojas</Badge>
                  ) : (
                    <Badge icon={<StoreDot storeId={r.storeId} />}>{stores.find((s) => s.id === r.storeId)?.name}</Badge>
                  )}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{r.body}</p>
              </div>
              <span className="flex shrink-0 gap-1">
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${r.shortcut}`} onClick={() => setEditing({ reply: r, isNew: false })}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Excluir ${r.shortcut}`}
                  onClick={() => {
                    actions.deleteQuickReply(r.id);
                    toast.success("Resposta rápida excluída", { description: "Somente nesta sessão." });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.isNew ? "Nova resposta rápida" : "Editar resposta rápida"}
            footer={
              <>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button size="sm" variant="primary" type="submit" form={formId} disabled={!shortcutValid || !editing.reply.title.trim() || !editing.reply.body.trim()}>
                  Salvar
                </Button>
              </>
            }
          >
            <form
              id={formId}
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                actions.saveQuickReply({ ...editing.reply, shortcut: editing.reply.shortcut.trim(), title: editing.reply.title.trim() }, editing.isNew);
                toast.success("Resposta rápida salva nesta sessão");
                setEditing(null);
              }}
            >
              <Field label="Atalho" error={!shortcutValid ? "Comece com / e use letras, números ou hífens." : undefined}>
                {(props) => <Input {...props} value={editing.reply.shortcut} onChange={(e) => setEditing({ ...editing, reply: { ...editing.reply, shortcut: e.target.value } })} />}
              </Field>
              <Field label="Loja">
                {(props) => (
                  <Select {...props} value={editing.reply.storeId} onChange={(e) => setEditing({ ...editing, reply: { ...editing.reply, storeId: e.target.value } })}>
                    <option value="all">Todas as lojas</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Título" className="sm:col-span-2">
                {(props) => <Input {...props} value={editing.reply.title} onChange={(e) => setEditing({ ...editing, reply: { ...editing.reply, title: e.target.value } })} />}
              </Field>
              <Field label="Texto" className="sm:col-span-2">
                {(props) => <Textarea {...props} rows={4} value={editing.reply.body} onChange={(e) => setEditing({ ...editing, reply: { ...editing.reply, body: e.target.value } })} />}
              </Field>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/* --------------------------------- Templates -------------------------------- */

export function TemplatesSection() {
  const { templates } = useDataset();
  const { actions } = useDemo();
  const formId = useId();
  const [editing, setEditing] = useState<{ template: MessageTemplate; isNew: boolean } | null>(null);

  return (
    <div>
      <SectionHeader
        slug="templates"
        actions={
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              setEditing({ template: { id: actions.newId("tp"), name: "", channel: "whatsapp", category: "Pedidos", status: "rascunho", body: "" }, isNew: true })
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Novo template
          </Button>
        }
      />
      <Callout tone="neutral" className="mb-4">
        Templates são usados por automações e pela equipe para iniciar conversas. Nenhum é enviado nesta versão.
      </Callout>
      {templates.length === 0 ? (
        <TableContainer>
          <EmptyState compact icon={FileText} title="Nenhum template" description="Crie mensagens padrão para rastreio, reembolsos e pesquisas." />
        </TableContainer>
      ) : (
        <TableContainer>
          <Table className="min-w-[640px]">
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Canal</Th>
                <Th>Categoria</Th>
                <Th>Estado</Th>
                <Th className="w-24">
                  <span className="sr-only">Ações</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <Tr key={t.id}>
                  <Td className="max-w-[280px]">
                    <span className="block font-medium text-ink">{t.name}</span>
                    <span className="block truncate text-xs text-ink-3">{t.body}</span>
                  </Td>
                  <Td>
                    {t.channel === "ambos" ? (
                      "WhatsApp e e-mail"
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={t.channel} className="text-ink-3" />
                        {t.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                      </span>
                    )}
                  </Td>
                  <Td>{t.category}</Td>
                  <Td>
                    <Badge tone={t.status === "ativo" ? "success" : "warning"} dot>
                      {t.status === "ativo" ? "Ativo" : "Rascunho"}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Editar ${t.name}`} onClick={() => setEditing({ template: t, isNew: false })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Excluir ${t.name}`}
                        onClick={() => {
                          actions.deleteTemplate(t.id);
                          toast.success("Template excluído", { description: "Somente nesta sessão." });
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.isNew ? "Novo template" : "Editar template"}
            footer={
              <>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button size="sm" variant="primary" type="submit" form={formId} disabled={!editing.template.name.trim() || !editing.template.body.trim()}>
                  Salvar
                </Button>
              </>
            }
          >
            <form
              id={formId}
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                actions.saveTemplate({ ...editing.template, name: editing.template.name.trim() }, editing.isNew);
                toast.success("Template salvo nesta sessão");
                setEditing(null);
              }}
            >
              <Field label="Nome" className="sm:col-span-2">
                {(props) => <Input {...props} value={editing.template.name} onChange={(e) => setEditing({ ...editing, template: { ...editing.template, name: e.target.value } })} />}
              </Field>
              <Field label="Canal">
                {(props) => (
                  <Select
                    {...props}
                    value={editing.template.channel}
                    onChange={(e) => setEditing({ ...editing, template: { ...editing.template, channel: e.target.value as MessageTemplate["channel"] } })}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="ambos">WhatsApp e e-mail</option>
                  </Select>
                )}
              </Field>
              <Field label="Estado">
                {(props) => (
                  <Select
                    {...props}
                    value={editing.template.status}
                    onChange={(e) => setEditing({ ...editing, template: { ...editing.template, status: e.target.value as MessageTemplate["status"] } })}
                  >
                    <option value="rascunho">Rascunho</option>
                    <option value="ativo">Ativo</option>
                  </Select>
                )}
              </Field>
              <Field label="Categoria" className="sm:col-span-2">
                {(props) => <Input {...props} value={editing.template.category} onChange={(e) => setEditing({ ...editing, template: { ...editing.template, category: e.target.value } })} />}
              </Field>
              <Field label="Mensagem" className="sm:col-span-2" description="Use as mesmas variáveis das respostas rápidas.">
                {(props) => <Textarea {...props} rows={5} value={editing.template.body} onChange={(e) => setEditing({ ...editing, template: { ...editing.template, body: e.target.value } })} />}
              </Field>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
