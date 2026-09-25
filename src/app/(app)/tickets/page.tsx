import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/data";
import { TicketsPage } from "@/features/tickets/tickets-page";

export const metadata: Metadata = { title: "Tickets" };

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton rows={8} className="p-6" />}>
      <TicketsPage />
    </Suspense>
  );
}
