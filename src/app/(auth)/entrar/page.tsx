import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DemoModeNotice, SignInForm } from "@/features/auth/auth-forms";
import { getCurrentSession } from "@/server/auth/current";
import { isBackendEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  // O modo (demonstração ou backend) depende do ambiente em tempo de execução, não do build.
  await connection();
  if (!isBackendEnabled()) return <DemoModeNotice />;
  if (await getCurrentSession()) redirect("/visao-geral");
  const { para } = await searchParams;
  return <SignInForm next={typeof para === "string" ? para : undefined} />;
}
