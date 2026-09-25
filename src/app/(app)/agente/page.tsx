import type { Metadata } from "next";
import { AgentPage } from "@/features/agent/agent-page";

export const metadata: Metadata = { title: "Agente de IA" };

export default function Page() {
  return <AgentPage />;
}
