/** Erro esperado, com código estável e mensagem segura para mostrar ao usuário. */
export class AppError extends Error {
  constructor(
    readonly code:
      | "invalid_input"
      | "email_taken"
      | "invalid_credentials"
      | "unauthenticated"
      | "forbidden"
      | "not_found"
      | "not_configured",
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
