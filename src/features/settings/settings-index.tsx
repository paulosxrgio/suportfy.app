import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { settingsGroups } from "./sections";

export function SettingsIndex() {
  return (
    <div>
      <header className="mb-5 border-b border-line pb-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink lg:hidden">Configurações</h1>
        <p className="text-[13px] text-ink-3 lg:text-sm lg:text-ink-2">
          Organização, canais, agente de IA e segurança. Integrações não estão conectadas nesta versão.
        </p>
      </header>
      <div className="space-y-6">
        {settingsGroups.map((g) => (
          <section key={g.label} aria-labelledby={`grupo-${g.label}`}>
            <h2 id={`grupo-${g.label}`} className="mb-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
              {g.label}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.slug}>
                    <Link href={`/configuracoes/${item.slug}`} className="focus-ring flex items-center gap-3 px-4 py-3 hover:bg-canvas focus-visible:-outline-offset-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas text-ink-3">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-ink">{item.label}</span>
                        <span className="block truncate text-xs text-ink-3">{item.description}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-4" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
