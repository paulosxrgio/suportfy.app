import type { HTMLAttributes, ReactNode } from "react";
import type { Tone } from "@/lib/demo/labels";
import { cn } from "@/lib/utils";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-subtle text-ink-2 ring-line",
  primary: "bg-primary-50 text-primary-700 ring-primary-200",
  ai: "bg-ai-50 text-ai-700 ring-ai-200",
  success: "bg-success-50 text-success-700 ring-success-200",
  warning: "bg-warning-50 text-warning-700 ring-warning-200",
  danger: "bg-danger-50 text-danger-700 ring-danger-200",
  note: "bg-note-50 text-note-700 ring-note-200",
  info: "bg-subtle text-primary-700 ring-highlight",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-ink-4",
  primary: "bg-primary-500",
  ai: "bg-ai-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  note: "bg-note-700",
  info: "bg-primary-400",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
  size?: "sm" | "md";
}

export function Badge({ tone = "neutral", dot, icon, size = "sm", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap ring-1 ring-inset [&_svg]:size-3 [&_svg]:shrink-0",
        size === "sm" ? "h-5 px-1.5 text-[11.5px]" : "h-6 px-2 text-xs",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dotClasses[tone])} aria-hidden />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function toneDot(tone: Tone) {
  return dotClasses[tone];
}
