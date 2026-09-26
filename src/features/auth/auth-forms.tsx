"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FlaskConical } from "lucide-react";
import { signInAction, signUpAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FormError({ state }: { state: AuthFormState }) {
  return (
    <p role="alert" aria-live="polite" className="min-h-5 text-[13px] text-danger-700">
      {state.error}
    </p>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signInAction, {});
  return (
    <Card title="Entrar" description="Acesse o painel de atendimento da sua loja.">
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="E-mail">
          {(p) => <Input {...p} name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />}
        </Field>
        <Field label="Senha">{(p) => <Input {...p} name="password" type="password" autoComplete="current-password" required />}</Field>
        <FormError state={state} />
        <Button type="submit" variant="primary" className="w-full" loading={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="focus-ring rounded font-medium text-primary-600 hover:underline">
          Criar conta
        </Link>
      </p>
    </Card>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, {});
  const f = state.fields ?? {};
  return (
    <Card title="Criar conta" description="Você será o proprietário da organização. A IA começa desligada até você conectar os canais e a chave da OpenAI.">
      <form action={action} className="space-y-4">
        <Field label="Seu nome">{(p) => <Input {...p} name="name" autoComplete="name" required defaultValue={f.name} />}</Field>
        <Field label="E-mail">{(p) => <Input {...p} name="email" type="email" autoComplete="email" required defaultValue={f.email} />}</Field>
        <Field label="Senha" description="Pelo menos 10 caracteres.">
          {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={10} required />}
        </Field>
        <Field label="Organização">
          {(p) => <Input {...p} name="organizationName" autoComplete="organization" required defaultValue={f.organizationName} />}
        </Field>
        <Field label="Primeira loja" description="Você poderá conectar a Shopify depois.">
          {(p) => <Input {...p} name="storeName" required defaultValue={f.storeName} />}
        </Field>
        <FormError state={state} />
        <Button type="submit" variant="primary" className="w-full" loading={pending}>
          {pending ? "Criando…" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="focus-ring rounded font-medium text-primary-600 hover:underline">
          Entrar
        </Link>
      </p>
    </Card>
  );
}

/** Exibida quando o ambiente não tem banco configurado (ex.: prévia de demonstração). */
export function DemoModeNotice() {
  return (
    <Card title="Ambiente de demonstração" description="Este ambiente não tem banco de dados configurado, então não há contas nem login.">
      <div className="flex items-start gap-2 rounded-md bg-subtle p-3 text-[13px] text-ink-2">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
        <p>A demonstração usa dados fictícios em memória. Nada é salvo nem enviado.</p>
      </div>
      <Button asChild variant="primary" className="mt-4 w-full">
        <Link href="/visao-geral">Abrir a demonstração</Link>
      </Button>
    </Card>
  );
}
