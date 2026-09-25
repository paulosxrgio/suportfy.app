"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export function DialogContent({ title, description, children, footer, size = "md", className }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/25 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-surface shadow-popover focus:outline-none data-[state=open]:animate-pop-in",
          sizes[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[15px] font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] text-ink-3">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="focus-ring -mt-1 -mr-2 rounded-md p-1.5 text-ink-3 hover:bg-subtle hover:text-ink"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
