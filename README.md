# Suportfy V4 — frontend

Plataforma de **atendimento automatizado por IA para lojas Shopify**. O agente de IA atende clientes por WhatsApp e e-mail, consulta pedidos e a base de conhecimento, resolve o que é permitido e encaminha exceções para uma fila de revisão humana. A equipe supervisiona e intervém só quando necessário.

> **Estado atual: backend com o canal WhatsApp de ponta a ponta.** Há banco PostgreSQL com isolamento por organização (RLS), login, chave da OpenAI cifrada, conexão de uma instância da Evolution API pela interface e o webhook autenticado que leva a mensagem do cliente até o agente e a resposta de volta pelo WhatsApp. A integração foi testada com provedores falsos que seguem os formatos oficiais; falta validar com uma instância real. Inbox, clientes e relatórios ainda usam dados de demonstração. Sem `DATABASE_URL`, o app roda inteiro em modo demonstração. Veja [`docs/arquitetura-backend.md`](docs/arquitetura-backend.md) e [`docs/plano-de-trabalho.md`](docs/plano-de-trabalho.md).

## Como executar

Requisitos: Node.js 20.9 ou superior e npm.

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. A raiz redireciona para `/visao-geral`.

### Com o backend

1. Copie `.env.example` para `.env.local` e preencha `DATABASE_URL` e `SUPORTFY_ENCRYPTION_KEY` (nunca versione esse arquivo).
2. Aplique as migrations: `npm run db:migrate`.
3. Rode `npm run dev` e crie uma conta em `/criar-conta`.
4. Para o WhatsApp: defina `SUPORTFY_PUBLIC_URL` (endereço público onde a Evolution API alcança o app), salve a chave da OpenAI e ligue o atendimento automático em Configurações › Inteligência Artificial, e conecte a instância em Configurações › WhatsApp.

Testes de integração (isolamento entre organizações, autenticação, segredos e pipeline do agente) precisam de um Postgres descartável:

```bash
TEST_DATABASE_URL=postgres://usuario@localhost:5432/postgres npm test
```

Sem `TEST_DATABASE_URL`, esses testes aparecem como *skipped*.

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Serve o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota do Next e roda `tsc --noEmit` |
| `npm run test` | Testes unitários (Vitest) |
| `npm run check` | Lint, typecheck e testes em sequência |
| `npm run db:migrate` | Aplica as migrations de `db/migrations` (usa `DATABASE_URL`) |

## Stack

- Backend no próprio Next.js (Server Components e Server Actions), PostgreSQL 15+ com `pg`, validação com `zod`

- Next.js 16 (App Router, Turbopack) e React 19, com TypeScript
- Tailwind CSS 4, com tokens definidos em `src/app/globals.css` (paleta "Cobalt Precision": fundo `#F8F9FF`, superfícies brancas, azul-cobalto `#004AC6` para ações e `#2563EB` para seleção, cores de status reservadas para IA atendendo, intervenção humana, resolvido e erro; raio de 6 px em botões e campos e de 8 px em cartões, painéis e gavetas)
- Primitivos acessíveis do Radix (`radix-ui`), ícones `lucide-react`, avisos com `sonner`
- Plus Jakarta Sans nos títulos e Inter no conteúdo, servidas localmente pelos pacotes `@fontsource-variable/*` (Geist Mono para trechos monoespaçados)
- Vitest e Testing Library para os testes

## Páginas

| Rota | Conteúdo |
| --- | --- |
| `/visao-geral` | Resumo do agente, indicadores, exceções que pedem atenção, estado real das integrações (nenhuma conectada), conversas por canal e atividade recente |
| `/inbox`, `/inbox/whatsapp`, `/inbox/email` | Tela central. No menu, a Inbox tem WhatsApp e E-mail como subitens; `/inbox` reúne os dois canais. A lista tem busca, um seletor de recorte (Para revisar, Com a IA, Com a equipe, Abertas, Não lidas, Aguardando resposta, Resolvidas, Menções, Participando, Não atribuídas, Todas) e filtros por prioridade, responsável, tags e loja. A conversa (`/inbox/<canal>/conversa/<id>`) ocupa a área principal: o estado da IA aparece numa linha discreta, e motivo do encaminhamento, detalhes da execução e fontes ficam recolhidos. O painel do cliente e dos pedidos pode ser recolhido. |
| `/tickets` | Fora do menu (são as mesmas conversas da Inbox); acessível pelo menu "…" da lista e por "Ver ticket" na conversa. Tabela com busca, filtros (status, prioridade, loja, canal, categoria, responsável), ordenação, detalhe em painel e criação manual |
| `/clientes` e `/clientes/[id]` | Lista com busca por nome, e-mail ou telefone, e perfil com conversas, pedidos e observações |
| `/pedidos` | Fora do menu: os pedidos são consultados na conversa e no perfil do cliente; a lista completa abre por "Ver todos os pedidos" em Clientes. Pedidos com filtros e detalhe (itens, endereço parcialmente oculto, pagamento, rastreio e ações bloqueadas) |
| `/automacoes`, `/automacoes/nova`, `/automacoes/[id]` | Lista de regras e construtor com gatilho, condições e ações |
| `/conhecimento` | Documentos, políticas e FAQs com status, versões e disponibilidade para o agente |
| `/agente` | Modos (automático, copiloto, desativado), ativação por loja e canal, identidade, tom, instruções, limites, transferências, fontes e prévia de resposta |
| `/relatorios` | Estrutura de métricas. Sem dados reais, mostra estados vazios; há um exemplo ilustrativo opcional e rotulado |
| `/equipe` | Fora do menu: aberta por Configurações › Equipe e permissões e pelo menu da conta. Membros, convites, equipes e matriz de permissões |
| `/configuracoes/[secao]` | 18 seções: Organização, Lojas, Shopify, WhatsApp, E-mail, Inteligência Artificial, Webhooks, API, Agente de IA, Conhecimento, Automações, Tags, Respostas rápidas, Templates, Equipe e permissões, Segurança, Auditoria e Custos |

## O que é demonstrativo

Com backend configurado, são reais: conta, login e sessão, organização e loja no menu, chave da OpenAI, liga/desliga do agente, conexão do WhatsApp e a atividade do canal. Todo o resto abaixo continua demonstrativo nos dois modos.

- **Dados.** Tudo vem de `src/lib/demo/data.ts`: lojas, clientes, pedidos, conversas, conhecimento, automações e equipe. Nomes e contatos são fictícios, e os e-mails usam os domínios reservados `example.com` e `.example`. Conversas, tickets, clientes e pedidos são o mesmo conjunto visto de ângulos diferentes, e os testes em `src/lib/demo/data.test.ts` garantem essa coerência.
- **Ações.** Assumir, pausar a IA, devolver à IA, transferir, resolver, aprovar rascunho, publicar conteúdo, convidar pessoas e salvar configurações alteram apenas o estado em memória (`src/lib/demo/store.tsx`). Nada é persistido, e tudo volta ao original ao recarregar. Cada ação aparece em Configurações › Auditoria.
- **Mensagens.** Respostas da equipe e rascunhos aprovados aparecem na conversa marcados como "Não enviada (demonstração)".
- **Chaves de API.** Com backend, a chave da OpenAI é cifrada no servidor e a tela mostra só os 4 últimos caracteres. No modo demonstração (e para Evolution API e Resend, em ambos os modos), os campos descartam o valor ao salvar: nada vai para estado global, `localStorage`, cookies nem logs.
- **Integrações.** Shopify, WhatsApp, e-mail e OpenAI aparecem como "Não conectado", que é o estado real. Os outros estados só aparecem nos seletores "Pré-visualizar estado da interface".
- **Controles da demonstração.** Na faixa do topo, permitem alternar entre dados de exemplo e uma conta sem dados, simular carregamento ou erro nas listas e restaurar os dados iniciais.
- **Relatórios.** Sem dados reais, mostram estados vazios. O exemplo ilustrativo usa números inventados, marcados em cada gráfico.

## Princípios do agente representados na interface

- O modo **automático** é o objetivo principal; o **copiloto** é uma opção de segurança e teste.
- O agente nunca inventa status de pedido, pagamento, envio, rastreio, política, prazo ou disponibilidade. Sem fonte confiável, pede o dado ou encaminha.
- Só conteúdo **publicado** da base de conhecimento é usado; rascunhos e arquivados ficam indisponíveis.
- Ações com consequências (cancelar pedido, reembolsar, alterar endereço, trocar produto, modificar compra) aparecem como "sujeitas a regras e validação" e não estão implementadas. No futuro, serão executadas somente por ferramentas no servidor com validações determinísticas.
- Todo encaminhamento para revisão registra o motivo e a regra aplicada.

## Estrutura

```text
db/migrations/          SQL versionado (tabelas, papel suportfy_app, políticas RLS)
scripts/db-migrate.mjs  Runner de migrations com checksum
src/
  app/                  Rotas (App Router). (app)/ contém as páginas com o shell.
  components/
    ui/                 Primitivos: botão, badge, campos, diálogos, drawer, menus, abas, tabela, estados
    shared/             Componentes de domínio: filtros, gráficos, selos de estado, cabeçalho de página
    shell/              Barra lateral (grupos Atendimento e Operação), seletores de organização e loja, faixa da demonstração
  features/             Uma pasta por área (inbox, tickets, customers, orders, agent, knowledge,
                        automations, reports, team, settings, overview)
  server/               Só servidor: env, banco (withTenant/withSystem), auth, segredos,
                        canais, agente de IA e pipeline de mensagens
  proxy.ts              Redireciona para /entrar quando não há sessão (com backend)
  lib/
    demo/               Tipos, dados fictícios, rótulos, seletores e estado em memória
    format.ts           Datas, moeda, máscaras e busca (determinísticos, fuso de São Paulo)
    ai-models.ts        Modelos permitidos pela aplicação (revisar antes da integração)
```

## Acessibilidade e responsividade

- Foco visível em todos os controles, atalho "Pular para o conteúdo", rótulos em campos e diálogos com foco preso (Radix).
- Gráficos com legenda, tooltip por teclado e alternativa em tabela.
- Desktop e tablet como alvo principal. Abaixo de 1024 px, a navegação vira um drawer e as Conversas alternam entre lista e conversa. Abaixo de 1280 px, o painel do cliente abre em drawer; acima disso, pode ser recolhido pelo botão no cabeçalho da conversa.

## Próximos passos

1. Autenticação, organizações e permissões por loja.
2. Banco de dados e API para conversas, tickets e configurações.
3. Armazenamento seguro de segredos no servidor (chave da OpenAI, Evolution API, Resend).
4. Integrações de leitura: Shopify (pedidos, clientes, produtos), WhatsApp via Evolution API e e-mail via Resend.
5. Agente de IA no servidor com ferramentas controladas, registro de fontes e motivos de encaminhamento.
6. Motor de automações e cálculo real de SLA e relatórios.
