import { Slot } from "radix-ui";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle" | "link";
type Size = "xs" | "sm" | "md" | "icon-xs" | "icon-sm" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-300 disabled:text-white/90",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-xs hover:bg-subtle active:bg-muted disabled:text-ink-4 disabled:bg-surface",
  subtle: "bg-subtle text-ink hover:bg-muted active:bg-line disabled:text-ink-4",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink active:bg-muted disabled:text-ink-4 disabled:bg-transparent",
  danger:
    "border border-danger-200 bg-surface text-danger-700 shadow-xs hover:bg-danger-50 active:bg-danger-50 disabled:text-ink-4 disabled:border-line",
  link: "h-auto px-0 text-primary-700 underline-offset-4 hover:underline disabled:text-ink-4",
};

const sizeClasses: Record<Size, string> = {
  xs: "h-7 gap-1 rounded-md px-2 text-xs",
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-md px-3.5 text-sm",
  "icon-xs": "size-7 rounded-md",
  "icon-sm": "size-8 rounded-md",
  icon: "size-9 rounded-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading = false, asChild = false, disabled, children, type, ...props },
  ref,
) {
  const classes = cn(
    "focus-ring inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed [&_svg]:shrink-0",
    variantClasses[variant],
    sizeClasses[size],
    variant === "link" && "h-auto px-0",
    className,
  );

  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
