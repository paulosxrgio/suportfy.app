"use client";

import { ErrorState } from "@/components/shared/demo";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[60vh] content-center">
      <ErrorState
        title="Algo deu errado ao exibir esta página"
        description="Tente novamente. Se o problema continuar, recarregue a página."
        onRetry={reset}
      />
    </div>
  );
}
