"use client";

import { CircleAlert, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ListSkeleton } from "@/components/ui/data";
import { Tooltip } from "@/components/ui/menu";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

/** Selo discreto indicando que o conteúdo ao lado é fictício. */
export function DemoBadge({ label = "Dados de demonstração", className }: { label?: string; className?: string }) {
  return (
    <Tooltip content="Conteúdo fictício, criado apenas para demonstrar a interface. Nenhuma integração está conectada.">
      <span
        tabIndex={0}
        className={cn(
          "focus-ring inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-dashed border-line-strong bg-surface px-1.5 text-[11.5px] font-medium whitespace-nowrap text-ink-3",
          className,
        )}
      >
        <FlaskConical className="size-3" aria-hidden />
        {label}
      </span>
    </Tooltip>
  );
}

export function ErrorState({ onRetry, title, description }: { onRetry?: () => void; title?: string; description?: string }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={title ?? "Não foi possível carregar os dados"}
      description={
        description ??
        "Esta falha foi simulada pelos controles da demonstração. Em produção, aqui aparecerá o motivo do erro e como resolver."
      }
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    />
  );
}

/**
 * Aplica a simulação de carregamento/erro escolhida nos controles da
 * demonstração, para que esses estados possam ser revisados em cada página.
 */
export function DataGate({ children, skeleton }: { children: ReactNode; skeleton?: ReactNode }) {
  const { state, actions } = useDemo();
  if (state.simulation === "loading") return <>{skeleton ?? <ListSkeleton />}</>;
  if (state.simulation === "error") return <ErrorState onRetry={() => actions.setSimulation("none")} />;
  return <>{children}</>;
}
