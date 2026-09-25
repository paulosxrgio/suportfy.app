import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/data";
import { AutomationBuilder } from "@/features/automations/automation-builder";

export const metadata: Metadata = { title: "Editar automação" };

export default async function Page({ params }: PageProps<"/automacoes/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={<ListSkeleton rows={6} className="p-6" />}>
      <AutomationBuilder key={id} id={id} />
    </Suspense>
  );
}
