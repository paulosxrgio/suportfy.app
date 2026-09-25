"use client";

import { ChevronDown, FlaskConical, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { useDemo, type DataMode, type Simulation } from "@/lib/demo/store";

/**
 * Indicação permanente e discreta de ambiente demonstrativo, com controles
 * para revisar estados da interface (sem dados, carregando, erro).
 */
export function DemoStrip() {
  const { state, actions } = useDemo();
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 text-[12.5px] text-ink-3">
      <FlaskConical className="size-3.5 shrink-0 text-ink-3" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium text-ink-2">
          <span className="sm:hidden">Demonstração</span>
          <span className="hidden sm:inline">Ambiente de demonstração</span>
        </span>
        <span className="hidden sm:inline">
          {" "}
          · Dados fictícios. Nenhuma integração, envio de mensagem ou IA real está ativa.
        </span>
      </p>
      {(state.dataMode === "empty" || state.simulation !== "none") && (
        <span className="hidden rounded-[5px] bg-warning-50 px-1.5 py-0.5 text-[11.5px] font-medium text-warning-700 md:inline">
          {state.dataMode === "empty" ? "Visualizando conta sem dados" : "Simulação de estado ativa"}
        </span>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="xs" variant="ghost" className="-mr-2 text-ink-2">
            <span className="sm:hidden">Controles</span>
            <span className="hidden sm:inline">Controles da demonstração</span>
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4">
          <p className="text-[13px] font-semibold text-ink">Controles da demonstração</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            Use para revisar como cada página se comporta. Nada aqui representa o estado de integrações reais.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-2" id="demo-data-label">
                Dados exibidos
              </p>
              <Segmented<DataMode>
                label="Dados exibidos"
                value={state.dataMode}
                onValueChange={actions.setDataMode}
                options={[
                  { value: "demo", label: "Demonstração" },
                  { value: "empty", label: "Conta sem dados" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-ink-2">Simular estado das listas</p>
              <Segmented<Simulation>
                label="Simular estado das listas"
                value={state.simulation}
                onValueChange={actions.setSimulation}
                options={[
                  { value: "none", label: "Normal" },
                  { value: "loading", label: "Carregando" },
                  { value: "error", label: "Erro" },
                ]}
              />
            </div>
            <div className="border-t border-line pt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  actions.reset();
                  toast.success("Dados da demonstração restaurados", {
                    description: "Todas as alterações desta sessão foram descartadas.",
                  });
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Restaurar dados iniciais
              </Button>
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                Alterações feitas nesta sessão ficam só na memória deste navegador e somem ao recarregar a página.
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
