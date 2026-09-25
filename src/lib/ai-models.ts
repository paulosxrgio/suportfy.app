/**
 * Modelos que a aplicação permitirá selecionar. A lista é definida pela
 * aplicação (não pelo usuário) e deve ser revisada, junto com os preços,
 * antes da integração real com a OpenAI. O servidor validará a escolha.
 */
export const allowedModels = [
  {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    description: "Equilíbrio entre qualidade e custo. Recomendado para a maioria das lojas.",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    description: "Maior capacidade para conversas complexas, com custo mais alto.",
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    description: "Menor custo, indicado para dúvidas simples e alto volume.",
  },
] as const;

export type AllowedModelId = (typeof allowedModels)[number]["id"];
