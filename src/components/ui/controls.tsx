"use client";

import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioPrimitive,
  Switch as SwitchPrimitive,
  Tabs as TabsPrimitive,
  ToggleGroup,
} from "radix-ui";
import { Check, Minus } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-line-strong transition-colors data-[state=checked]:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[17px]" />
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "focus-ring flex size-4 shrink-0 items-center justify-center rounded border border-line-strong bg-surface shadow-xs data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 data-[state=indeterminate]:border-primary-600 data-[state=indeterminate]:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-white">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export const RadioGroup = RadioPrimitive.Root;

/** Opção em formato de cartão selecionável (usada para modos e escolhas com descrição). */
export function RadioCard({
  value,
  title,
  description,
  badge,
  icon,
  disabled,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <RadioPrimitive.Item
      value={value}
      disabled={disabled}
      className="focus-ring group flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong data-[state=checked]:border-primary-500 data-[state=checked]:bg-primary-50/60 data-[state=checked]:ring-1 data-[state=checked]:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface group-data-[state=checked]:border-primary-600">
        <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary-600" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
          <span className="text-sm font-medium text-ink">{title}</span>
          {badge}
        </span>
        {description && <span className="mt-1 block text-[13px] leading-snug text-ink-3">{description}</span>}
      </span>
    </RadioPrimitive.Item>
  );
}

export function RadioOption({ value, label, disabled }: { value: string; label: ReactNode; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink-4">
      <RadioPrimitive.Item
        value={value}
        disabled={disabled}
        className="focus-ring flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface data-[state=checked]:border-primary-600"
      >
        <RadioPrimitive.Indicator className="size-2 rounded-full bg-primary-600" />
      </RadioPrimitive.Item>
      {label}
    </label>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-center gap-1 overflow-x-auto border-b border-line scrollbar-thin", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "focus-ring relative -mb-px flex h-9 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink data-[state=active]:border-primary-600 data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/** Controle segmentado de seleção única. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = "sm",
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  label: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded-md border border-line bg-subtle p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "focus-ring flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap text-ink-3 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:text-ink-4 data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-xs",
            size === "xs" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
