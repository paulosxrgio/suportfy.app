import type { Metadata } from "next";
import { OverviewPage } from "@/features/overview/overview-page";

export const metadata: Metadata = { title: "Visão geral" };

export default function Page() {
  return <OverviewPage />;
}
