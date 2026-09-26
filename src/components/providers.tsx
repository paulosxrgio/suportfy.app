"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/menu";
import { DemoProvider } from "@/lib/demo/store";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DemoProvider>
      <TooltipProvider delayDuration={300} skipDelayDuration={200}>
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !border !border-line !bg-surface !text-ink !shadow-popover !font-sans",
              title: "!text-[13px] !font-medium",
              description: "!text-[12.5px] !text-ink-3",
            },
          }}
        />
      </TooltipProvider>
    </DemoProvider>
  );
}
