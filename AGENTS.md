<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Suportfy V4

Plataforma de atendimento automatizado por IA para lojas Shopify. Nesta fase o repositório é **somente frontend demonstrativo**; veja o `README.md`.

## Regras do projeto

- Textos da interface em português do Brasil, com linguagem natural e consistente.
- Não apresentar dados fictícios como reais. Todo conteúdo de exemplo vem de `src/lib/demo/data.ts` e é sinalizado na tela (`DemoBadge`, faixa de demonstração). Use apenas contatos fictícios em domínios reservados (`example.com`, `.example`).
- Não afirmar que uma integração, envio, autenticação ou persistência funciona se ela não existe. Botões sem backend devem dar retorno claro (diálogo, aviso ou estado desabilitado com explicação).
- Segredos (chaves de API) nunca vão para estado global, `localStorage`, cookies, código versionado ou logs. Use `SecretField` em `src/features/settings/common.tsx`.
- O posicionamento é "IA primeiro": a intervenção humana é exceção supervisionada. Ações com consequências (cancelar, reembolsar, alterar endereço, trocar produto) aparecem como "sujeitas a regras e validação" e não são executadas.
- Datas e horários passam por `src/lib/format.ts`, que é determinístico (fuso de São Paulo, "agora" fixo da demonstração) para evitar divergência de hidratação.
- Cores e espaçamentos vêm dos tokens em `src/app/globals.css`. Tema claro apenas.

## Onde fica cada coisa

- Rotas: `src/app/(app)/…`. Cada página delega para um componente em `src/features/<área>/`.
- Primitivos de UI: `src/components/ui/`. Componentes de domínio: `src/components/shared/`. Shell: `src/components/shell/`.
- Estado da demonstração e ações: `src/lib/demo/store.tsx` (`useDemo`, `useDataset`).

## Antes de enviar mudanças

```bash
npm run check   # lint, typecheck e testes
npm run build
git diff --check
```
