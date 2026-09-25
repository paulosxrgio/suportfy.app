import { NotFoundContent } from "@/components/shared/not-found-content";
import { AppShell } from "@/components/shell/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <NotFoundContent />
    </AppShell>
  );
}
