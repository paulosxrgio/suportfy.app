"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";

export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    onValueChange: (value: string) => void;
    label: string;
    wrapperClassName?: string;
  }
>(function SearchField({ value, onValueChange, label, wrapperClassName, className, ...props }, ref) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "h-9 w-full rounded-xl border border-line-strong bg-surface pr-8 pl-8 text-[13px] text-ink placeholder:text-ink-4 hover:border-ink-4 focus:border-primary-500 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary-200 [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="focus-ring absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-ink-4 hover:text-ink"
          aria-label="Limpar busca"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
});

export interface FilterOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Filtro de múltipla escolha em menu suspenso. */
export function FilterMenu<T extends string>({
  label,
  options,
  selected,
  onChange,
  align = "start",
}: {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  align?: "start" | "end";
}) {
  const active = selected.length > 0;
  const first = options.find((o) => o.value === selected[0]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className={cn("font-normal text-ink-2", active && "border-primary-300 bg-primary-50/60 text-primary-800 hover:bg-primary-50")}
        >
          <span className={cn(active && "font-medium")}>
            {label}
            {active && (
              <>
                <span className="text-ink-4">: </span>
                {selected.length === 1 && typeof first?.label === "string" ? first.label : `${selected.length}`}
              </>
            )}
          </span>
          <ChevronDown className="size-3.5 text-ink-3" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))
            }
          >
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="min-w-0 truncate">{o.label}</span>
              {o.count !== undefined && <span className="text-xs text-ink-4 tabular-nums">{o.count}</span>}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>Limpar seleção</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function ResultCount({ count, singular, plural }: { count: number; singular: string; plural: string }) {
  return (
    <p className="text-[13px] text-ink-3" aria-live="polite">
      {count} {count === 1 ? singular : plural}
    </p>
  );
}
