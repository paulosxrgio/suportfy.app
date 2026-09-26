import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  // Seções retiradas das configurações: endereços antigos voltam para o índice.
  async redirects() {
    return ["horarios", "notificacoes", "sla"].map((secao) => ({
      source: `/configuracoes/${secao}`,
      destination: "/configuracoes",
      permanent: false,
    }));
  },
};

export default nextConfig;
