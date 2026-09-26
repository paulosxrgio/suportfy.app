import { CircleAlert, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------- Tabela ---------- */

export function TableContainer({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line bg-surface scrollbar-thin", className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-[13px]", className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 border-b border-line bg-canvas/60 px-3 text-xs font-medium whitespace-nowrap text-ink-3 first:pl-4 last:pr-4",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("h-12 border-b border-line px-3 align-middle text-ink-2 first:pl-4 last:pr-4", className)} {...props} />;
}

export function Tr({ className, interactive, selected, ...props }: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean; selected?: boolean }) {
  return (
    <tr
      className={cn(
        "[&:last-child>td]:border-b-0",
        interactive && "cursor-pointer transition-colors hover:bg-canvas focus-within:bg-canvas",
        selected && "bg-primary-50/60 hover:bg-primary-50/80",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Avatar ---------- */

const avatarPalette = ["#e7eef3", "#efe9f3", "#f3ece4", "#e6f1ea", "#f3e8ea", "#e9ecf5"];
const avatarInk = ["#2c5566", "#5a3f72", "#7a5427", "#2c6143", "#7a3446", "#39478a"];

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const index = hash % avatarPalette.length;
  const sizes = {
    xs: "size-5 text-[9.5px]",
    sm: "size-6 text-[10.5px]",
    md: "size-8 text-xs",
    lg: "size-11 text-sm",
  };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", sizes[size], className)}
      style={{ backgroundColor: avatarPalette[index], color: avatarInk[index] }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded bg-muted", className)} aria-hidden />;
}

export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-line", className)} role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/* ---------- Estados ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
  titleAs: TitleTag = "p",
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  titleAs?: "p" | "h1" | "h2";
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-md border border-line bg-canvas text-ink-3">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <TitleTag className="text-sm font-medium text-ink">{title}</TitleTag>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

type CalloutTone = "info" | "warning" | "danger" | "neutral";

const calloutClasses: Record<CalloutTone, string> = {
  info: "border-primary-200 bg-primary-50/70 text-ink-2 [&_[data-icon]]:text-primary-600",
  warning: "border-warning-200 bg-warning-50 text-ink-2 [&_[data-icon]]:text-warning-700",
  danger: "border-danger-200 bg-danger-50 text-ink-2 [&_[data-icon]]:text-danger-700",
  neutral: "border-line bg-canvas text-ink-2 [&_[data-icon]]:text-ink-3",
};

const calloutIcons: Record<CalloutTone, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: Info,
};

export function Callout({
  tone = "info",
  title,
  children,
  action,
  icon,
  className,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? calloutIcons[tone];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[13px]", calloutClasses[tone], className)}>
      <Icon data-icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------- Painel ---------- */

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-lg border border-line bg-surface", className)} aria-label={typeof title === "string" ? title : undefined}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DefinitionList({ items, className }: { items: { term: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2 text-[13px]", className)}>
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{item.term}</dt>
          <dd className="min-w-0 text-ink tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-canvas px-1 font-sans text-[11px] text-ink-3">
      {children}
    </kbd>
  );
}
