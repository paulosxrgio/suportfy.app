import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DemoModeNotice, SignUpForm } from "@/features/auth/auth-forms";
import { getCurrentSession } from "@/server/auth/current";
import { isBackendEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  // O modo (demonstração ou backend) depende do ambiente em tempo de execução, não do build.
  await connection();
  if (!isBackendEnabled()) return <DemoModeNotice />;
  if (await getCurrentSession()) redirect("/visao-geral");
  return <SignUpForm />;
}
