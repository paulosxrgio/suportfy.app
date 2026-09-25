"use client";

import { Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { integrationStateMeta, type IntegrationState } from "@/components/shared/domain";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Callout } from "@/components/ui/data";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { findSection } from "./sections";

export function SectionHeader({ slug, actions, meta }: { slug: string; actions?: ReactNode; meta?: ReactNode }) {
  const section = findSection(slug);
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ink">{section?.label}</h1>
          {meta}
        </div>
        <p className="mt-0.5 text-[13px] text-ink-3">{section?.description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Linha de configuração: rótulo e descrição à esquerda, controle à direita. */
export function SettingRow({ label, description, children, htmlFor }: { label: ReactNode; description?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
            {label}
          </label>
        ) : (
          <p className="text-[13px] font-medium text-ink">{label}</p>
        )}
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Formulário de configurações com valores guardados só em memória nesta
 * sessão. Nunca use para segredos (chaves de API): veja `SecretField`.
 */
export function useSessionSettings<T>(section: string, label: string, defaults: T) {
  const { state, actions } = useDemo();
  const saved = (state.settings[section] as T | undefined) ?? defaults;
  const [value, setValue] = useState<T>(saved);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  return {
    value,
    set: <K extends keyof T>(key: K, v: T[K]) => setValue((prev) => ({ ...prev, [key]: v })),
    setValue,
    dirty,
    reset: () => setValue(saved),
    save: () => {
      actions.saveSettings(section, label, value);
      toast.success("Configurações salvas nesta sessão", { description: "Sem servidor nesta etapa: os valores somem ao recarregar a página." });
    },
  };
}

export function SaveFooter({ dirty, onSave, onReset }: { dirty: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {dirty && <span className="mr-auto text-[13px] text-ink-3">Alterações não salvas.</span>}
      <Button size="sm" variant="ghost" onClick={onReset} disabled={!dirty}>
        Descartar
      </Button>
      <Button size="sm" variant="primary" onClick={onSave} disabled={!dirty}>
        Salvar alterações
      </Button>
    </div>
  );
}

/**
 * Campo para chaves e segredos. O valor digitado nunca é guardado em estado
 * global, armazenamento do navegador ou logs: ao "salvar", ele é descartado,
 * porque o armazenamento seguro no servidor ainda não existe.
 */
export function SecretField({
  label,
  description,
  placeholder,
  prefixHint,
  auditTarget,
}: {
  label: string;
  description?: ReactNode;
  placeholder?: string;
  /** Prefixo esperado (ex.: "sk-"), apenas para aviso de formato. */
  prefixHint?: string;
  auditTarget: string;
}) {
  const { actions } = useDemo();
  const id = useId();
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const formatWarning = prefixHint && value.length > 3 && !value.startsWith(prefixHint);

  const submit = () => {
    if (!value.trim()) return;
    setValue("");
    setVisible(false);
    actions.log("Tentou salvar chave (descartada, sem armazenamento seguro)", auditTarget);
    toast.info("A chave não foi salva", {
      description: "O armazenamento seguro no servidor ainda não existe. O valor digitado foi descartado e não ficou no navegador.",
    });
  };

  return (
    <form
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-1.5"
    >
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" aria-hidden />
          <input
            id={id}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            data-lpignore="true"
            data-1p-ignore="true"
            aria-describedby={`${id}-desc`}
            className="h-9 w-full rounded-md border border-line-strong bg-surface pr-10 pl-8 font-mono text-[13px] text-ink shadow-xs placeholder:font-sans placeholder:text-ink-4 focus:border-primary-500 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-200"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="focus-ring absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1.5 text-ink-3 hover:text-ink"
            aria-label={visible ? "Ocultar valor digitado" : "Mostrar valor digitado"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button type="submit" size="md" variant="primary" disabled={!value.trim()}>
          Salvar chave
        </Button>
      </div>
      <p id={`${id}-desc`} className={cn("text-xs", formatWarning ? "text-warning-700" : "text-ink-3")}>
        {formatWarning ? `O formato esperado começa com “${prefixHint}”. Confira se copiou a chave inteira.` : description}
      </p>
    </form>
  );
}

/** Seletor que permite revisar cada estado visual de uma integração, sem conexão real. */
export function StatePreview({
  value,
  onChange,
  states,
  labels,
}: {
  value: IntegrationState;
  onChange: (s: IntegrationState) => void;
  states: IntegrationState[];
  labels?: Partial<Record<IntegrationState, string>>;
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-canvas px-3 py-2.5">
      <p className="mb-2 text-xs text-ink-3">
        <span className="font-medium text-ink-2">Pré-visualizar estado da interface.</span> Apenas para revisão: não reflete uma
        conexão real.
      </p>
      <Segmented<IntegrationState>
        label="Pré-visualizar estado"
        size="xs"
        value={value}
        onValueChange={onChange}
        options={states.map((s) => ({ value: s, label: labels?.[s] ?? integrationStateMeta[s].label }))}
      />
    </div>
  );
}

export function ValidatingRow({ text }: { text: string }) {
  return (
    <Callout tone="info" icon={LoaderCircle} className="[&_[data-icon]]:animate-spin">
      {text}
    </Callout>
  );
}
