import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/data";
import { OrdersPage } from "@/features/orders/orders-page";

export const metadata: Metadata = { title: "Pedidos" };

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton rows={8} className="p-6" />}>
      <OrdersPage />
    </Suspense>
  );
}
