import type { Metadata } from "next";
import { SettingsShell } from "@/features/settings/settings-shell";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsLayout({ children }: LayoutProps<"/configuracoes">) {
  return <SettingsShell>{children}</SettingsShell>;
}
