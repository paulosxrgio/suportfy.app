"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { allSettingsSections, settingsGroups } from "./sections";

/** Navegação interna das configurações: coluna lateral em telas largas, seletor em telas menores. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = allSettingsSections.find((s) => pathname === `/configuracoes/${s.slug}`);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] gap-8 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <nav aria-label="Seções de configurações" className="hidden w-56 shrink-0 lg:block">
        <Link href="/configuracoes" className="focus-ring mb-4 block rounded text-xl font-semibold tracking-[-0.01em] text-ink">
          Configurações
        </Link>
        <div className="space-y-4">
          {settingsGroups.map((g) => (
            <div key={g.label}>
              <p className="mb-1 px-2 text-[11.5px] font-medium text-ink-4">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = current?.slug === item.slug;
                  const Icon = item.icon;
                  return (
                    <li key={item.slug}>
                      <Link
                        href={`/configuracoes/${item.slug}`}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "focus-ring flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
                          active ? "bg-primary-50 font-medium text-primary-800" : "text-ink-2 hover:bg-subtle hover:text-ink",
                        )}
                      >
                        <Icon className={cn("size-4 shrink-0", active ? "text-primary-600" : "text-ink-4")} aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0 flex-1">
        {current && (
          <div className="mb-4 lg:hidden">
            <label htmlFor="settings-section" className="mb-1 block text-xs font-medium text-ink-3">
              Seção
            </label>
            <Select id="settings-section" value={current.slug} onChange={(e) => router.push(`/configuracoes/${e.target.value}`)}>
              {settingsGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
