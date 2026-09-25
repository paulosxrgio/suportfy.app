"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { teams } from "@/lib/demo/data";
import { roleMeta } from "@/lib/demo/labels";
import { CURRENT_USER_ID, useDataset, useDemo } from "@/lib/demo/store";
import type { Conversation } from "@/lib/demo/types";

export function TransferDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: Conversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { actions } = useDemo();
  const { members } = useDataset();
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const formId = useId();
  const people = members.filter((m) => m.status === "ativo" && m.id !== conversation.assigneeId);

  const submit = () => {
    if (!target) return;
    const [kind, id] = target.split(":");
    actions.transfer(conversation.id, kind === "m" ? { memberId: id } : { teamId: id }, note);
    const name = kind === "m" ? (id === CURRENT_USER_ID ? "você" : members.find((m) => m.id === id)?.name) : teams.find((t) => t.id === id)?.name;
    toast.success(`Conversa transferida para ${name}`, { description: "Nenhuma notificação real foi enviada (demonstração)." });
    setTarget("");
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Transferir conversa"
        description="Escolha uma pessoa ou equipe. Ao transferir para uma equipe, a conversa entra na fila de revisão dela."
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button size="sm" variant="primary" type="submit" form={formId} disabled={!target}>
              Transferir
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Transferir para">
            {(props) => (
              <Select {...props} value={target} onChange={(e) => setTarget(e.target.value)} required>
                <option value="" disabled>
                  Selecione
                </option>
                <optgroup label="Equipes">
                  {teams.map((t) => (
                    <option key={t.id} value={`t:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Pessoas">
                  {people.map((m) => (
                    <option key={m.id} value={`m:${m.id}`}>
                      {m.id === CURRENT_USER_ID ? `${m.name} (você)` : m.name} · {roleMeta[m.role].label}
                    </option>
                  ))}
                </optgroup>
              </Select>
            )}
          </Field>
          <Field label="Nota interna" optional description="Explique o contexto para quem vai receber. O cliente não vê esta nota.">
            {(props) => <Textarea {...props} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />}
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
