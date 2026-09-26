"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { DemoStrip } from "./demo-strip";
import { Logo } from "./logo";
import { currentSection } from "./nav-config";
import { SidebarContent } from "./sidebar";

function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = currentSection(pathname);
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="focus-ring rounded-md p-2 text-ink-2 hover:bg-subtle" aria-label="Abrir menu de navegação">
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent title="Menu" side="left" width="w-[min(88vw,280px)]" hideTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/visao-geral" className="focus-ring rounded-md" aria-label="Suportfy, ir para a visão geral">
        <Logo />
      </Link>
      {current && (
        <>
          <span className="text-ink-4" aria-hidden>
            /
          </span>
          <span className="truncate text-sm font-medium text-ink-2">{current}</span>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useDemo();
  const collapsed = state.sidebarCollapsed;
  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#conteudo"
        className="sr-only z-[70] rounded-md bg-ink px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-line bg-surface transition-[width] duration-150 lg:block",
          collapsed ? "w-[60px]" : "w-[232px]",
        )}
        aria-label="Menu lateral"
      >
        <SidebarContent collapsed={collapsed} showCollapseToggle />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoStrip />
        <MobileTopBar />
        <main id="conteudo" tabIndex={-1} className="relative min-h-0 flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
