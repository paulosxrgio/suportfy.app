"use client";

import { Bot, Check, Ellipsis, Mail, Minus, SearchX, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataGate, DemoBadge } from "@/components/shared/demo";
import { StoreDot } from "@/components/shared/domain";
import { FilterBar, FilterMenu, ResultCount, SearchField } from "@/components/shared/filters";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, RadioGroup, RadioOption, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/controls";
import { Avatar, Callout, EmptyState, ListSkeleton, Panel, Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/menu";
import { teams } from "@/lib/demo/data";
import { memberStatusMeta, roleMeta } from "@/lib/demo/labels";
import { CURRENT_USER_ID, stores, useDataset, useDemo } from "@/lib/demo/store";
import type { Member, MemberStatus, Role } from "@/lib/demo/types";
import { formatDateShort, formatRelative, matchesQuery } from "@/lib/format";

const assignableRoles: Role[] = ["administrador", "supervisor", "atendente", "leitura"];

function StoresLabel({ storeIds }: { storeIds: Member["storeIds"] }) {
  if (storeIds === "all") return <span>Todas as lojas</span>;
  if (storeIds.length === 0) return <span className="text-ink-4">Nenhuma</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {storeIds.map((id) => (
        <span key={id} className="inline-flex items-center gap-1">
          <StoreDot storeId={id} />
          {stores.find((s) => s.id === id)?.name}
        </span>
      ))}
    </span>
  );
}

function AccessForm({
  formId,
  initial,
  withEmail,
  onSubmit,
}: {
  formId: string;
  initial: Pick<Member, "role" | "teamIds" | "storeIds"> & { email?: string };
  withEmail?: boolean;
  onSubmit: (value: Pick<Member, "role" | "teamIds" | "storeIds"> & { email: string }) => void;
}) {
  const [email, setEmail] = useState(initial.email ?? "");
  const [role, setRole] = useState<Role>(initial.role);
  const [teamIds, setTeamIds] = useState<string[]>(initial.teamIds);
  const [scope, setScope] = useState<"all" | "some">(initial.storeIds === "all" ? "all" : "some");
  const [storeIds, setStoreIds] = useState<string[]>(initial.storeIds === "all" ? [] : initial.storeIds);
  const [touched, setTouched] = useState(false);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const storesValid = scope === "all" || storeIds.length > 0;

  return (
    <form
      id={formId}
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if ((withEmail && !emailValid) || !storesValid) return;
        onSubmit({ email: email.trim(), role, teamIds, storeIds: scope === "all" ? "all" : storeIds });
      }}
    >
      {withEmail && (
        <Field label="E-mail" error={touched && !emailValid ? "Informe um e-mail válido." : undefined}>
          {(props) => <Input {...props} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" autoComplete="off" />}
        </Field>
      )}
      <Field label="Função" description={roleMeta[role].description}>
        {(props) => (
          <Select {...props} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {roleMeta[r].label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink">Equipes</legend>
        <div className="space-y-1">
          {teams.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
              <Checkbox
                checked={teamIds.includes(t.id)}
                onCheckedChange={(on) => setTeamIds(on === true ? [...teamIds, t.id] : teamIds.filter((x) => x !== t.id))}
              />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink">Lojas acessíveis</legend>
        <RadioGroup value={scope} onValueChange={(v) => setScope(v as "all" | "some")} className="flex gap-4" aria-label="Escopo de lojas">
          <RadioOption value="all" label="Todas as lojas" />
          <RadioOption value="some" label="Lojas específicas" />
        </RadioGroup>
        {scope === "some" && (
          <div className="mt-2 space-y-1 pl-6">
            {stores.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                <Checkbox
                  checked={storeIds.includes(s.id)}
                  onCheckedChange={(on) => setStoreIds(on === true ? [...storeIds, s.id] : storeIds.filter((x) => x !== s.id))}
                />
                <StoreDot storeId={s.id} />
                {s.name}
              </label>
            ))}
            {touched && !storesValid && <p className="text-xs text-danger-700">Selecione ao menos uma loja.</p>}
          </div>
        )}
      </fieldset>
    </form>
  );
}

const permissions: { label: string; roles: Role[] }[] = [
  { label: "Ver conversas e tickets", roles: ["proprietario", "administrador", "supervisor", "atendente", "leitura"] },
  { label: "Assumir conversas e responder clientes", roles: ["proprietario", "administrador", "supervisor", "atendente"] },
  { label: "Pausar a IA e devolver conversas ao agente", roles: ["proprietario", "administrador", "supervisor", "atendente"] },
  { label: "Aprovar respostas no modo copiloto", roles: ["proprietario", "administrador", "supervisor", "atendente"] },
  { label: "Configurar o agente de IA", roles: ["proprietario", "administrador", "supervisor"] },
  { label: "Publicar conteúdo de conhecimento", roles: ["proprietario", "administrador", "supervisor"] },
  { label: "Gerenciar automações", roles: ["proprietario", "administrador", "supervisor"] },
  { label: "Ver relatórios", roles: ["proprietario", "administrador", "supervisor", "leitura"] },
  { label: "Convidar e gerenciar pessoas", roles: ["proprietario", "administrador"] },
  { label: "Integrações, chaves e webhooks", roles: ["proprietario", "administrador"] },
  { label: "Custos e cobrança", roles: ["proprietario"] },
];

export function TeamPage() {
  const { members, isEmpty, agent } = useDataset();
  const { actions } = useDemo();
  const [query, setQuery] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [statuses, setStatuses] = useState<MemberStatus[]>([]);
  const [invite, setInvite] = useState({ open: false, key: 0 });
  const [editing, setEditing] = useState<Member | null>(null);
  const [removing, setRemoving] = useState<Member | null>(null);
  const inviteForm = useId();
  const editForm = useId();

  const rows = useMemo(
    () =>
      members.filter((m) => {
        if (roles.length && !roles.includes(m.role)) return false;
        if (statuses.length && !statuses.includes(m.status)) return false;
        return matchesQuery(query, m.name, m.email);
      }),
    [members, roles, statuses, query],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Equipe"
        description="Pessoas que supervisionam o agente e assumem as exceções, com função e lojas acessíveis."
        meta={<DemoBadge />}
        actions={
          <Button size="sm" variant="primary" onClick={() => setInvite((s) => ({ open: true, key: s.key + 1 }))}>
            <UserPlus className="size-3.5" aria-hidden />
            Convidar pessoa
          </Button>
        }
      />

      <Callout tone="warning" className="mb-4">
        A autenticação ainda não foi implementada: convites não são enviados por e-mail e as permissões não são aplicadas.
      </Callout>

      <Tabs defaultValue="membros">
        <TabsList>
          <TabsTrigger value="membros">Membros ({members.length})</TabsTrigger>
          <TabsTrigger value="equipes">Equipes ({teams.length})</TabsTrigger>
          <TabsTrigger value="funcoes">Funções e permissões</TabsTrigger>
        </TabsList>

        <TabsContent value="membros" className="pt-4 focus:outline-none">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchField label="Buscar pessoas" placeholder="Buscar por nome ou e-mail" value={query} onValueChange={setQuery} wrapperClassName="lg:w-72" />
            <FilterBar>
              <FilterMenu
                label="Função"
                selected={roles}
                onChange={setRoles}
                options={(Object.keys(roleMeta) as Role[]).map((r) => ({ value: r, label: roleMeta[r].label, count: members.filter((m) => m.role === r).length }))}
              />
              <FilterMenu
                label="Estado"
                selected={statuses}
                onChange={setStatuses}
                options={(Object.keys(memberStatusMeta) as MemberStatus[]).map((s) => ({
                  value: s,
                  label: memberStatusMeta[s].label,
                  count: members.filter((m) => m.status === s).length,
                }))}
              />
            </FilterBar>
          </div>
          <DataGate skeleton={<TableContainer><ListSkeleton rows={6} /></TableContainer>}>
            {rows.length === 0 ? (
              <TableContainer>
                <EmptyState icon={SearchX} title="Nenhuma pessoa encontrada" description="Ajuste a busca ou os filtros." />
              </TableContainer>
            ) : (
              <>
                <TableContainer>
                  <Table className="min-w-[920px]">
                    <thead>
                      <tr>
                        <Th>Pessoa</Th>
                        <Th>Função</Th>
                        <Th>Equipes</Th>
                        <Th>Lojas</Th>
                        <Th>Estado</Th>
                        <Th>Último acesso</Th>
                        <Th className="w-12">
                          <span className="sr-only">Ações</span>
                        </Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m) => {
                        const st = memberStatusMeta[m.status];
                        const isMe = m.id === CURRENT_USER_ID;
                        return (
                          <Tr key={m.id}>
                            <Td>
                              <span className="flex items-center gap-2.5">
                                <Avatar name={m.name} />
                                <span className="min-w-0">
                                  <span className="block font-medium text-ink">
                                    {m.name}
                                    {isMe && <span className="ml-1 font-normal text-ink-3">(você)</span>}
                                  </span>
                                  <span className="block text-xs text-ink-3">{m.email}</span>
                                </span>
                              </span>
                            </Td>
                            <Td>{roleMeta[m.role].label}</Td>
                            <Td className="max-w-[200px]">
                              {m.teamIds.length ? m.teamIds.map((t) => teams.find((x) => x.id === t)?.name).join(", ") : <span className="text-ink-4">—</span>}
                            </Td>
                            <Td className="max-w-[240px]">
                              <StoresLabel storeIds={m.storeIds} />
                            </Td>
                            <Td>
                              <Badge tone={st.tone} dot>
                                {st.label}
                              </Badge>
                            </Td>
                            <Td className="whitespace-nowrap text-ink-3">
                              {m.status === "ativo" && m.lastSeenAt
                                ? formatRelative(m.lastSeenAt)
                                : m.invitedAt
                                  ? `Convidado em ${formatDateShort(m.invitedAt)}`
                                  : "—"}
                            </Td>
                            <Td>
                              {m.role !== "proprietario" && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon-sm" variant="ghost" aria-label={`Ações para ${m.name}`}>
                                      <Ellipsis className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-52">
                                    <DropdownMenuItem onSelect={() => setEditing(m)}>
                                      <ShieldCheck aria-hidden />
                                      Gerenciar acesso
                                    </DropdownMenuItem>
                                    {m.status !== "ativo" && (
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          actions.resendInvite(m.id);
                                          toast.success("Reenvio registrado", { description: "Demonstração: nenhum e-mail foi enviado." });
                                        }}
                                      >
                                        <Mail aria-hidden />
                                        Reenviar convite
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem danger onSelect={() => setRemoving(m)}>
                                      <Trash2 aria-hidden />
                                      {m.status === "ativo" ? "Remover da organização" : "Cancelar convite"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableContainer>
                <div className="mt-3">
                  <ResultCount count={rows.length} singular="pessoa" plural="pessoas" />
                </div>
                {isEmpty && (
                  <p className="mt-2 text-[13px] text-ink-3">Conta nova: apenas a pessoa proprietária. Convide a equipe que vai supervisionar o agente.</p>
                )}
              </>
            )}
          </DataGate>
        </TabsContent>

        <TabsContent value="equipes" className="pt-4 focus:outline-none">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((t) => {
              const people = members.filter((m) => m.teamIds.includes(t.id));
              return (
                <Panel
                  key={t.id}
                  title={t.name}
                  description={t.description}
                  actions={
                    agent.handoffTeamId === t.id && (
                      <Badge tone="primary" icon={<Bot aria-hidden />}>
                        Recebe encaminhamentos da IA
                      </Badge>
                    )
                  }
                >
                  {people.length ? (
                    <ul className="space-y-2">
                      {people.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-[13px]">
                          <Avatar name={m.name} size="sm" />
                          <span className="flex-1 text-ink">{m.name}</span>
                          <span className="text-xs text-ink-3">{roleMeta[m.role].label}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact icon={Users} title="Sem membros" description="Adicione pessoas pelo gerenciamento de acesso." />
                  )}
                </Panel>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="funcoes" className="pt-4 focus:outline-none">
          <TableContainer>
            <Table className="min-w-[760px]">
              <thead>
                <tr>
                  <Th>Permissão</Th>
                  {(Object.keys(roleMeta) as Role[]).map((r) => (
                    <Th key={r} className="text-center">
                      {roleMeta[r].label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <Tr key={p.label}>
                    <Td className="text-ink">{p.label}</Td>
                    {(Object.keys(roleMeta) as Role[]).map((r) => (
                      <Td key={r} className="text-center">
                        {p.roles.includes(r) ? (
                          <Check className="mx-auto size-4 text-success-700" aria-label="Permitido" />
                        ) : (
                          <Minus className="mx-auto size-4 text-ink-4" aria-label="Não permitido" />
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
          <p className="mt-3 text-xs text-ink-3">Proposta de permissões por função. Será aplicada quando a autenticação for implementada.</p>
        </TabsContent>
      </Tabs>

      <Dialog open={invite.open} onOpenChange={(open) => setInvite((s) => ({ ...s, open }))}>
        <DialogContent
          title="Convidar pessoa"
          description="Nesta demonstração, o convite é apenas registrado na lista. Nenhum e-mail é enviado."
          footer={
            <>
              <DialogClose asChild>
                <Button size="sm" variant="ghost">
                  Cancelar
                </Button>
              </DialogClose>
              <Button size="sm" variant="primary" type="submit" form={inviteForm}>
                Registrar convite
              </Button>
            </>
          }
        >
          <AccessForm
            key={invite.key}
            formId={inviteForm}
            withEmail
            initial={{ role: "atendente", teamIds: [], storeIds: "all" }}
            onSubmit={(v) => {
              actions.inviteMember({ name: v.email.split("@")[0], email: v.email, role: v.role, teamIds: v.teamIds, storeIds: v.storeIds });
              toast.success("Convite registrado", { description: "Demonstração: nenhum e-mail foi enviado." });
              setInvite((s) => ({ ...s, open: false }));
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent
            title={`Gerenciar acesso · ${editing.name}`}
            footer={
              <>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button size="sm" variant="primary" type="submit" form={editForm}>
                  Salvar acesso
                </Button>
              </>
            }
          >
            <AccessForm
              key={editing.id}
              formId={editForm}
              initial={editing}
              onSubmit={(v) => {
                actions.updateMember(editing.id, { role: v.role, teamIds: v.teamIds, storeIds: v.storeIds });
                toast.success("Acesso atualizado", { description: "Mantido apenas nesta sessão." });
                setEditing(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        {removing && (
          <DialogContent
            size="sm"
            title={removing.status === "ativo" ? `Remover ${removing.name}?` : "Cancelar convite?"}
            description={
              removing.status === "ativo"
                ? "A pessoa perde o acesso a todas as lojas da organização."
                : `O convite para ${removing.email} será cancelado.`
            }
            footer={
              <>
                <DialogClose asChild>
                  <Button size="sm" variant="ghost">
                    Voltar
                  </Button>
                </DialogClose>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    actions.removeMember(removing.id);
                    toast.success(removing.status === "ativo" ? "Pessoa removida" : "Convite cancelado", { description: "Somente nesta sessão." });
                    setRemoving(null);
                  }}
                >
                  {removing.status === "ativo" ? "Remover" : "Cancelar convite"}
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </PageContainer>
  );
}
