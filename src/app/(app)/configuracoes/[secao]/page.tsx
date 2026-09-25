import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsSectionView } from "@/features/settings/section-view";
import { allSettingsSections, findSection } from "@/features/settings/sections";

export function generateStaticParams() {
  return allSettingsSections.map((s) => ({ secao: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/configuracoes/[secao]">): Promise<Metadata> {
  const { secao } = await params;
  return { title: findSection(secao)?.label ?? "Configurações" };
}

export default async function Page({ params }: PageProps<"/configuracoes/[secao]">) {
  const { secao } = await params;
  if (!findSection(secao)) notFound();
  return <SettingsSectionView slug={secao} />;
}
