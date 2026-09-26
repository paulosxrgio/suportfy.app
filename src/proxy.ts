import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/cookie";

/**
 * Checagem otimista: sem cookie de sessão, manda para o login. A validação de
 * verdade (sessão existe, não expirou) acontece no servidor, no layout das
 * páginas do app. Sem banco configurado, o app segue em modo demonstração.
 */
export function proxy(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = new URL("/entrar", request.url);
  const path = request.nextUrl.pathname;
  if (path !== "/") url.searchParams.set("para", path + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|entrar|criar-conta|icon.svg|favicon.ico).*)"],
};
