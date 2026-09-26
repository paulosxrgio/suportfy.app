import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6 shrink-0", className)} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#2563eb" />
      <path d="M8 6.5h8a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-4.6L8 17.6V15a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" fill="#fff" />
      <path d="M9.4 10.75h5.2" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      {!collapsed && <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Suportfy</span>}
    </span>
  );
}
