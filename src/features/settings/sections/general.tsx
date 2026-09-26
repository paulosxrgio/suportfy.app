"use client";

import Link from "next/link";
import { History, SearchX, ShoppingBag, Store as StoreIcon, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { IntegrationBadge, StoreDot } from "@/components/shared/domain";
import { FilterMenu, SearchField } from "@/components/shared/filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Avatar, Callout, EmptyState, Panel, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { organization } from "@/lib/demo/data";
import { channelLabels } from "@/lib/demo/labels";
import { CURRENT_USER_ID, stores, useDataset } from "@/lib/demo/store";
import { formatDateTime, matchesQuery } from "@/lib/format";
import { SaveFooter, SectionHeader, SettingRow, useSessionSettings } from "../common";

/* ------------------------------- Organização -------------------------------- */

export function OrganizationSection() {
  const form = useSessionSettings("organizacao", "Organização", {
    name: organization.name,
    legalName: "",
    cnpj: "",
    timezone: "America/Sao_Paulo",
    language: "pt-BR",
  });
  const cnpjDigits = form.value.cnpj.replace(/\D/g, "");
  const cnpjError = cnpjDigits.length > 0 && cnpjDigits.length !== 14 ? "O CNPJ tem 14 dígitos." : undefined;
  return (
    <div>
      <SectionHeader slug="organizacao" />
      <Panel title="Dados da organização">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" className="md:col-span-2">
            {(props) => <Input {...props} value={form.value.name} onChange={(e) => form.set("name", e.target.value)} />}
          </Field>
          <Field label="Razão social" optional>
            {(props) => <Input {...props} value={form.value.legalName} onChange={(e) => form.set("legalName", e.target.value)} />}
          </Field>
          <Field label="CNPJ" optional error={cnpjError}>
            {(props) => (
              <Input {...props} inputMode="numeric" placeholder="00.000.000/0000-00" value={form.value.cnpj} onChange={(e) => form.set("cnpj", e.target.value.replace(/[^\d./-]/g, ""))} />
            )}
          </Field>
          <Field label="Fuso horário padrão" description="Usado em horários, SLA e relatórios.">
            {(props) => (
              <Select {...props} value={form.value.timezone} onChange={(e) => form.set("timezone", e.target.value)}>
                <option value="America/Sao_Paulo">Brasília (UTC−3)</option>
                <option value="America/Manaus">Manaus (UTC−4)</option>
                <option value="America/Rio_Branco">Rio Branco (UTC−5)</option>
                <option value="America/Noronha">Fernando de Noronha (UTC−2)</option>
              </Select>
            )}
          </Field>
          <Field label="Idioma da interface">
            {(props) => (
              <Select {...props} value={form.value.language} onChange={(e) => form.set("language", e.target.value)}>
                <option value="pt-BR">Português (Brasil)</option>
              </Select>
            )}
          </Field>
        </div>
        <SaveFooter dirty={form.dirty && !cnpjError} onSave={form.save} onReset={form.reset} />
      </Panel>
    </div>
  );
}

/* ---------------------------------- Lojas ----------------------------------- */

export function StoresSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <SectionHeader
        slug="lojas"
        actions={
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <StoreIcon className="size-3.5" aria-hidden />
            Adicionar loja
          </Button>
        }
      />
      <TableContainer>
        <Table className="min-w-[720px]">
          <thead>
            <tr>
              <Th>Loja</Th>
              <Th>Prefixo dos pedidos</Th>
              <Th>Canais</Th>
              <Th>Shopify</Th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <StoreDot storeId={s.id} className="size-2.5" />
                    {s.name}
                  </span>
                </Td>
                <Td>
                  <code className="text-xs">#{s.orderPrefix}</code>
                </Td>
                <Td className="text-ink-2">
                  {channelLabels.whatsapp} · {channelLabels.email}
                </Td>
                <Td>
                  <IntegrationBadge state="nao_configurado" />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
      <p className="text-xs text-ink-3">Lojas fictícias da demonstração. Os canais estão configurados apenas visualmente.</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Adicionar loja"
          description="Novas lojas são criadas ao conectar uma conta Shopify, para que pedidos e clientes venham da fonte correta."
          footer={
            <>
              <DialogClose asChild>
                <Button size="sm" variant="ghost">
                  Fechar
                </Button>
              </DialogClose>
              <Button asChild size="sm" variant="primary">
                <Link href="/configuracoes/shopify">
                  <ShoppingBag className="size-3.5" aria-hidden />
                  Ir para a conexão Shopify
                </Link>
              </Button>
            </>
          }
        >
          <Callout tone="neutral">A integração com a Shopify ainda não foi implementada, por isso nenhuma loja pode ser adicionada agora.</Callout>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------- Segurança --------------------------------- */

export function SecuritySection() {
  const form = useSessionSettings("seguranca", "Segurança", {
    sessionHours: "12",
    allowedDomains: "horizonte.example",
    maskForAgents: true,
    retentionMonths: "24",
  });
  return (
    <div className="space-y-4">
      <SectionHeader slug="seguranca" />
      <Callout tone="warning">A autenticação ainda não foi implementada. Estas regras serão aplicadas quando houver login.</Callout>
      <Panel title="Acesso">
        <SettingRow label="Verificação em duas etapas obrigatória" description="Disponível quando a autenticação for implementada.">
          <Switch checked={false} disabled aria-label="Verificação em duas etapas obrigatória" />
        </SettingRow>
        <SettingRow label="Duração máxima da sessão" htmlFor="sec-session">
          <Select id="sec-session" wrapperClassName="w-44" value={form.value.sessionHours} onChange={(e) => form.set("sessionHours", e.target.value)}>
            <option value="8">8 horas</option>
            <option value="12">12 horas</option>
            <option value="24">24 horas</option>
            <option value="168">7 dias</option>
          </Select>
        </SettingRow>
        <SettingRow label="Domínios permitidos para convites" description="Separe por vírgula." htmlFor="sec-domains">
          <Input id="sec-domains" className="w-64" value={form.value.allowedDomains} onChange={(e) => form.set("allowedDomains", e.target.value)} />
        </SettingRow>
      </Panel>
      <Panel title="Proteção de dados (LGPD)">
        <SettingRow label="Mascarar contatos para a função Atendente" description="E-mail e telefone aparecem parcialmente ocultos; revelar fica registrado na auditoria.">
          <Switch checked={form.value.maskForAgents} onCheckedChange={(v) => form.set("maskForAgents", v)} aria-label="Mascarar contatos para atendentes" />
        </SettingRow>
        <SettingRow label="Retenção de conversas" description="Depois desse prazo, conversas e anexos serão anonimizados." htmlFor="sec-retention">
          <Select id="sec-retention" wrapperClassName="w-44" value={form.value.retentionMonths} onChange={(e) => form.set("retentionMonths", e.target.value)}>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
            <option value="24">24 meses</option>
            <option value="60">5 anos</option>
          </Select>
        </SettingRow>
        <SaveFooter dirty={form.dirty} onSave={form.save} onReset={form.reset} />
      </Panel>
    </div>
  );
}

/* --------------------------------- Auditoria -------------------------------- */

export function AuditSection() {
  const { audit, members } = useDataset();
  const [query, setQuery] = useState("");
  const [actors, setActors] = useState<string[]>([]);
  const rows = useMemo(
    () => audit.filter((a) => (!actors.length || actors.includes(a.actorId)) && matchesQuery(query, a.action, a.target)),
    [audit, actors, query],
  );
  const name = (id: string) => (id === CURRENT_USER_ID ? "Você" : (members.find((m) => m.id === id)?.name ?? "Equipe"));
  return (
    <div>
      <SectionHeader slug="auditoria" />
      <Callout tone="neutral" className="mb-4">
        Inclui exemplos fictícios e as ações feitas por você nesta sessão de demonstração. Nada é persistido.
      </Callout>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField label="Buscar na auditoria" placeholder="Buscar ação ou alvo" value={query} onValueChange={setQuery} wrapperClassName="sm:w-72" />
        <FilterMenu
          label="Pessoa"
          selected={actors}
          onChange={setActors}
          options={Array.from(new Set(audit.map((a) => a.actorId))).map((id) => ({ value: id, label: name(id) }))}
        />
      </div>
      {rows.length === 0 ? (
        <TableContainer>
          <EmptyState compact icon={audit.length ? SearchX : History} title={audit.length ? "Nenhum registro encontrado" : "Sem registros"} description={audit.length ? "Ajuste a busca ou o filtro." : "As ações feitas na organização aparecerão aqui."} />
        </TableContainer>
      ) : (
        <TableContainer>
          <Table className="min-w-[640px]">
            <thead>
              <tr>
                <Th>Quando</Th>
                <Th>Pessoa</Th>
                <Th>Ação</Th>
                <Th>Alvo</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap text-ink-3 tabular-nums">{formatDateTime(a.at)}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Avatar name={members.find((m) => m.id === a.actorId)?.name ?? "Equipe"} size="xs" />
                      {name(a.actorId)}
                    </span>
                  </Td>
                  <Td className="text-ink">{a.action}</Td>
                  <Td className="max-w-[260px] truncate">{a.target}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

/* ---------------------------------- Custos ---------------------------------- */

export function CostsSection() {
  return (
    <div className="space-y-4">
      <SectionHeader slug="custos" meta={<Badge>Plano: {organization.plan}</Badge>} />
      <Callout tone="neutral">Cobrança ainda não implementada. Nenhum valor é cobrado nesta demonstração.</Callout>
      <Panel title="Consumo de IA">
        <EmptyState
          compact
          icon={Wallet}
          title="Sem consumo"
          description="Nenhuma chamada à OpenAI foi feita. Quando houver, aqui aparecerão custo total, custo médio por conversa e consumo por loja."
          action={
            <Button asChild size="sm">
              <Link href="/configuracoes/inteligencia-artificial">Definir orçamento de IA</Link>
            </Button>
          }
        />
      </Panel>
      <Panel title="Como o custo será calculado">
        <ul className="space-y-2 text-[13px] leading-relaxed text-ink-2">
          <li>
            <span className="font-medium text-ink">IA:</span> tokens consumidos em cada conversa, multiplicados pelo preço do modelo
            escolhido. O custo por conversa resolvida será exibido nos relatórios.
          </li>
          <li>
            <span className="font-medium text-ink">WhatsApp:</span> infraestrutura da Evolution API, contratada à parte.
          </li>
          <li>
            <span className="font-medium text-ink">E-mail:</span> envios no plano do Resend, contratado à parte.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

