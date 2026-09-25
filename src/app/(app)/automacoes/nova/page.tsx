import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/data";
import { AutomationBuilder } from "@/features/automations/automation-builder";

export const metadata: Metadata = { title: "Nova automação" };

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} className="p-6" />}>
      <AutomationBuilder />
    </Suspense>
  );
}
