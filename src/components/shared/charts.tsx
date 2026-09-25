"use client";

/**
 * Gráficos simples em HTML/CSS, sem biblioteca externa.
 * Barras finas (≤ 24px) com ponta arredondada, grade discreta, tooltip por
 * marca (mouse e teclado) e, nos gráficos com várias séries, legenda sempre
 * visível. Cada gráfico pode ser alternado para uma tabela equivalente.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/controls";
import { Table, TableContainer, Td, Th, Tr } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/menu";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Series {
  name: string;
  /** Classe Tailwind de fundo (ex.: "bg-chart-1"). */
  colorClass: string;
}

export const seriesAiTeam: Series[] = [
  { name: "Resolvidas ou conduzidas pela IA", colorClass: "bg-chart-1" },
  { name: "Com participação da equipe", colorClass: "bg-chart-2" },
];

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-[3px]", s.colorClass)} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Alterna entre o gráfico e uma tabela com os mesmos valores. */
export function ChartFrame({
  title,
  description,
  chart,
  table,
  legend,
  footer,
  className,
}: {
  title: string;
  description?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  legend?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("flex flex-col rounded-lg border border-line bg-surface", className)} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
        </div>
        <Segmented
          label={`Visualização de ${title}`}
          size="xs"
          value={view}
          onValueChange={setView}
          options={[
            { value: "chart", label: "Gráfico" },
            { value: "table", label: "Tabela" },
          ]}
        />
      </header>
      <div className="flex-1 px-4 pt-3 pb-4">
        {view === "chart" ? (
          <>
            {legend && <div className="mb-3">{legend}</div>}
            {chart}
          </>
        ) : (
          table
        )}
      </div>
      {footer && <div className="border-t border-line px-4 py-2.5 text-xs text-ink-3">{footer}</div>}
    </section>
  );
}

export interface BarItem {
  label: ReactNode;
  key: string;
  value: number;
  href?: string;
}

/** Barras horizontais de uma série (magnitude em categorias nominais). */
export function BarList({ items, format = formatNumber, unit }: { items: BarItem[]; format?: (v: number) => string; unit?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct = (item.value / max) * 100;
        const label = (
          <span className="min-w-0 truncate text-[13px] text-ink-2">{item.label}</span>
        );
        return (
          <li key={item.key} className="grid grid-cols-[minmax(96px,34%)_1fr] items-center gap-3">
            {item.href ? (
              <Link href={item.href} className="focus-ring min-w-0 truncate rounded hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
            <Tooltip content={`${typeof item.label === "string" ? item.label : ""}: ${format(item.value)}${unit ? ` ${unit}` : ""}`}>
              <span tabIndex={0} className="focus-ring group flex h-6 items-center gap-2 rounded" aria-label={`${format(item.value)}${unit ? ` ${unit}` : ""}`}>
                <span
                  className="h-3.5 rounded-r-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
                  style={{ width: `max(${pct}%, 2px)` }}
                />
                <span className="text-xs font-medium text-ink-2 tabular-nums">{format(item.value)}</span>
              </span>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

export interface StackedRow {
  key: string;
  label: ReactNode;
  values: number[];
}

/** Barras horizontais empilhadas (parte do todo por linha), com 2px de respiro entre segmentos. */
export function StackedBars({ rows, series, format = formatNumber }: { rows: StackedRow[]; series: Series[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.values.reduce((a, b) => a + b, 0)));
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const total = row.values.reduce((a, b) => a + b, 0);
        return (
          <li key={row.key} className="grid grid-cols-[minmax(80px,26%)_1fr] items-center gap-3">
            <span className="min-w-0 truncate text-[13px] text-ink-2">{row.label}</span>
            <span className="flex items-center gap-2">
              <span className="flex h-4 items-stretch gap-[2px]" style={{ width: `${(total / max) * 88}%` }}>
                {row.values.map((v, i) =>
                  v > 0 ? (
                    <Tooltip key={series[i].name} content={`${series[i].name}: ${format(v)}`}>
                      <span
                        tabIndex={0}
                        aria-label={`${series[i].name}: ${format(v)}`}
                        className={cn(
                          "focus-ring block hover:opacity-80",
                          series[i].colorClass,
                          i === row.values.length - 1 || row.values.slice(i + 1).every((x) => x === 0) ? "rounded-r-[4px]" : "",
                        )}
                        style={{ flexGrow: v, flexBasis: 0 }}
                      />
                    </Tooltip>
                  ) : null,
                )}
              </span>
              <span className="text-xs font-medium text-ink-2 tabular-nums">{format(total)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export interface ColumnPoint {
  key: string;
  label: string;
  values: number[];
}

/** Colunas empilhadas ao longo do tempo, com eixo Y em números redondos. */
export function ColumnChart({ points, series, height = 180 }: { points: ColumnPoint[]; series: Series[]; height?: number }) {
  const rawMax = Math.max(1, ...points.map((p) => p.values.reduce((a, b) => a + b, 0)));
  const step = rawMax <= 10 ? 2 : rawMax <= 50 ? 10 : rawMax <= 100 ? 20 : 50;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step).reverse();
  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between pb-5 text-right text-[11px] text-ink-4 tabular-nums" style={{ height: height + 20 }} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1.5 leading-none">
            {formatNumber(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-chart-axis" : "bg-chart-grid")}
              style={{ bottom: `${(t / max) * 100}%` }}
              aria-hidden
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-around gap-1">
            {points.map((p) => {
              const total = p.values.reduce((a, b) => a + b, 0);
              return (
                <Tooltip
                  key={p.key}
                  content={
                    <span className="block">
                      <span className="block font-medium">{p.label}</span>
                      {series.map((s, i) => (
                        <span key={s.name} className="block">
                          <strong className="font-semibold">{formatNumber(p.values[i])}</strong> · {s.name}
                        </span>
                      ))}
                    </span>
                  }
                >
                  <span
                    tabIndex={0}
                    aria-label={`${p.label}: ${series.map((s, i) => `${s.name} ${p.values[i]}`).join(", ")}`}
                    className="focus-ring group flex h-full w-full max-w-6 flex-col-reverse items-stretch justify-start gap-[2px] rounded-t-[4px]"
                  >
                    {p.values.map((v, i) =>
                      v > 0 ? (
                        <span
                          key={i}
                          className={cn(
                            "block group-hover:opacity-80",
                            series[i].colorClass,
                            p.values.slice(i + 1).every((x) => x === 0) && "rounded-t-[4px]",
                          )}
                          style={{ height: `calc(${(v / max) * 100}% - 2px)` }}
                        />
                      ) : null,
                    )}
                    {total === 0 && <span className="sr-only">Sem conversas</span>}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>
        <div className="mt-1.5 flex justify-around gap-1 text-[11px] text-ink-4" aria-hidden>
          {points.map((p, i) => (
            <span key={p.key} className={cn("w-6 text-center whitespace-nowrap", i % 2 === 1 && "max-sm:invisible")}>
              {p.label.split(" ")[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Meter({ value, label, target }: { value: number; label: string; target?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="text-sm font-semibold text-ink">{Math.round(pct)}%</span>
      </div>
      <div
        className="relative mt-1.5 h-2 rounded-full bg-chart-1-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label}
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
        {target !== undefined && (
          <span className="absolute -inset-y-1 w-px bg-ink-3" style={{ left: `${target}%` }} title={`Meta: ${target}%`} aria-hidden />
        )}
      </div>
      {target !== undefined && <p className="mt-1 text-xs text-ink-3">Meta: {target}%</p>}
    </div>
  );
}

export function SimpleTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <TableContainer>
      <Table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <Th key={h} className={i > 0 ? "text-right" : undefined}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <Tr key={ri}>
              {r.map((cell, ci) => (
                <Td key={ci} className={cn("h-9", ci > 0 && "text-right tabular-nums")}>
                  {cell}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

export function StatTile({
  label,
  value,
  detail,
  href,
  attention,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  attention?: boolean;
}) {
  const content = (
    <>
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-[-0.01em]", attention ? "text-warning-700" : "text-ink")}>{value}</p>
      {detail && <p className="mt-1 text-xs text-ink-3">{detail}</p>}
    </>
  );
  const className = "block rounded-lg border border-line bg-surface px-4 py-3.5";
  return href ? (
    <Link href={href} className={cn(className, "focus-ring transition-colors hover:border-line-strong")}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
