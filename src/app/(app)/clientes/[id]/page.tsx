import type { Metadata } from "next";
import { CustomerProfile } from "@/features/customers/customer-profile";

export const metadata: Metadata = { title: "Cliente" };

export default async function Page({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  return <CustomerProfile id={id} />;
}
