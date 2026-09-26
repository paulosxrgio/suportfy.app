import { redirect } from "next/navigation";
import { connection } from "next/server";
import { BackendProvider, type BackendContextValue } from "@/components/backend-context";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentSession } from "@/server/auth/current";
import { isBackendEnabled } from "@/server/env";
import { loadLiveContext } from "@/server/live-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O modo (demonstração ou backend) depende do ambiente em tempo de execução, não do build.
  await connection();
  let value: BackendContextValue = { mode: "demo" };
  if (isBackendEnabled()) {
    const session = await getCurrentSession();
    if (!session) redirect("/entrar");
    value = await loadLiveContext(session);
  }
  return (
    <BackendProvider value={value}>
      <AppShell>{children}</AppShell>
    </BackendProvider>
  );
}
