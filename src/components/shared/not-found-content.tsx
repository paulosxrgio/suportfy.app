import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/data";

export function NotFoundContent({
  title = "Página não encontrada",
  description = "O endereço pode estar incorreto ou o conteúdo não existe nesta demonstração.",
  href = "/visao-geral",
  cta = "Ir para a visão geral",
}: {
  title?: string;
  description?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <EmptyState
      icon={FileQuestion}
      title={title}
      description={description}
      className="min-h-[60vh]"
      action={
        <Button asChild variant="primary" size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
      }
    />
  );
}
