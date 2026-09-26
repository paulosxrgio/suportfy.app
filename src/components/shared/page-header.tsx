import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
  breadcrumbs,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3 pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Trilha de navegação" className="mb-1.5">
            <ol className="flex flex-wrap items-center gap-1 text-[13px] text-ink-3">
              {breadcrumbs.map((c, i) => (
                <li key={i} className="flex items-center gap-1">
                  {c.href ? (
                    <Link href={c.href} className="focus-ring rounded hover:text-ink hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && <ChevronRight className="size-3.5 text-ink-4" aria-hidden />}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Contêiner padrão das páginas com rolagem própria. */
export function PageContainer({ children, className, width = "wide" }: { children: ReactNode; className?: string; width?: "wide" | "narrow" | "full" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6",
        width === "wide" && "max-w-[1320px]",
        width === "narrow" && "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
