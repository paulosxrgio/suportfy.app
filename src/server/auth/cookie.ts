/** Nome do cookie de sessão. `__Host-` em produção: só HTTPS, sem domínio, path "/". */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-suportfy_session" : "suportfy_session";
