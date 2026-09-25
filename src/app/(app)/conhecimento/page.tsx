import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/data";
import { KnowledgePage } from "@/features/knowledge/knowledge-page";

export const metadata: Metadata = { title: "Conhecimento" };

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton rows={8} className="p-6" />}>
      <KnowledgePage />
    </Suspense>
  );
}
