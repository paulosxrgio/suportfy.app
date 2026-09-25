"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

interface SheetContentProps {
  title: ReactNode;
  description?: ReactNode;
  side?: "right" | "left";
  width?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  hideTitle?: boolean;
  className?: string;
}

/** Painel lateral modal (drawer). Usado para detalhes e para a navegação em telas menores. */
export function SheetContent({
  title,
  description,
  side = "right",
  width = "w-[min(100vw,440px)]",
  header,
  footer,
  children,
  hideTitle,
  className,
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/20 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-surface focus:outline-none",
          side === "right"
            ? "right-0 border-l border-line shadow-drawer data-[state=open]:animate-slide-in-right"
            : "left-0 border-r border-line shadow-popover data-[state=open]:animate-slide-in-left",
          width,
          className,
        )}
      >
        <div className={cn("flex items-start justify-between gap-3 border-b border-line px-4 py-3", hideTitle && "sr-only")}>
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="truncate text-[15px] font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-[13px] text-ink-3">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
            {header}
          </div>
          <DialogPrimitive.Close
            className="focus-ring -mr-1 rounded-md p-1.5 text-ink-3 hover:bg-subtle hover:text-ink"
            aria-label="Fechar painel"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
