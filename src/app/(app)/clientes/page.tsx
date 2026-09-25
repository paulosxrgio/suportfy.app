import type { Metadata } from "next";
import { CustomersPage } from "@/features/customers/customers-page";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return <CustomersPage />;
}
