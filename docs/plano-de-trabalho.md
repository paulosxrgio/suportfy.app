# Plano de trabalho — Suportfy V4

Atualizado em 26/09/2026, após a primeira fatia do backend. Detalhes técnicos em
[`arquitetura-backend.md`](./arquitetura-backend.md). As versões anteriores
(`suport-fy`, `suportfybr`, `suportfy-v2`, `suportfy-whatsapp`) seguem como referência
de aprendizado; nenhum código foi copiado.

## Onde estamos

- **Frontend** navegável com o design aprovado: paleta Cobalt Precision, navegação em
  Atendimento e Operação, Inbox separada em WhatsApp e E-mail, sem telas de Pedidos,
  Equipe, SLA, Notificações e Horários no menu.
- **Backend — fundação (esta fatia):**
  - PostgreSQL com migrations reproduzíveis e verificadas em base limpa.
  - Multi-tenant (organização → lojas) com RLS e privilégios por coluna.
  - Login, cadastro e sessões seguras; o app exige login quando há banco configurado.
  - Chave da OpenAI cifrada por organização (ou loja), só de escrita, com teste de conexão.
  - Modelos de clientes, pedidos, canais, conversas, mensagens, eventos e consumo de IA.
  - Pipeline do agente completo e testado: recebimento idempotente, travas, contexto
    com pedidos da loja, resposta estruturada validada, outbox com novas tentativas.
  - Adaptadores Evolution API (WhatsApp) e Resend (e-mail), sem marcar nada como
    conectado.
- **Ainda demonstração:** as telas de atendimento (Inbox, Visão geral, Clientes,
  Relatórios etc.) e as preferências do agente. Nenhum canal conectado; nada chama o
  pipeline em produção ainda.

## Decisões tomadas

| # | Decisão | Situação |
| --- | --- | --- |
| 1 | WhatsApp via **Evolution API**, provedor já definido na interface do V4 | Adotado para esta fase. O adaptador isola o provedor; migrar para a Meta Cloud API continua possível e deve ser reavaliado pelo risco de bloqueio de número em API não oficial. |
| 2 | Banco próprio do V4 (PostgreSQL + RLS), com conceitos de isolamento da V2 reescritos | Implementado. Independe de Supabase (usa `app.user_id`, não `auth.uid()`). |
| 3 | Processamento dentro do app Next.js: fila no Postgres (outbox) + job agendado | Outbox implementada; webhooks e job agendado ficam para a próxima fatia. |
| 4 | Chave da OpenAI por organização, com substituição opcional por loja | Implementado (a interface ainda gerencia só a da organização). |
| 5 | Contrato do agente: saída JSON estrita; pedidos, rastreios e links citados precisam existir no contexto | Implementado (v1). |
| 6 | **Sem atendimento humano como fluxo de produto.** A IA atende; quando não pode responder com segurança, não envia e registra o motivo (`ai_status = 'error'`). | Decidido. O backend não tem atribuição, transferência nem fila de operadores. |
| 7 | Modo demonstração mantido quando não há `DATABASE_URL` | Implementado, para prévias sem banco. |

### Divergência registrada entre interface e backend

A Inbox demonstrativa ainda mostra ações de atendimento humano ("Assumir",
"Transferir", "Para revisar", filtros por responsável, equipe "Revisão e exceções").
Elas contradizem a decisão 6. Não foram alteradas agora porque esta fatia não liga a
Inbox ao backend; serão retiradas ou convertidas em controles do agente (pausar e
retomar a IA na conversa, ver o motivo do erro) quando a Inbox passar a usar dados reais.

## Decisões pendentes

| # | Decisão | Por que importa |
| --- | --- | --- |
| A | Critério para ligar o agente em produção (período de teste, métricas mínimas) | Hoje o agente começa desligado em toda loja nova. |
| B | Tabela de preços por modelo | `src/server/ai/pricing.ts` usa valores estimados; revisar com a tabela oficial antes de ativar. |
| C | Recebimento de e-mail (webhook inbound da Resend ou outro provedor) | Sem isso, a Inbox de e-mail só envia. |
| D | Onde hospedar o Postgres e como rodar as migrations no deploy | Ex.: Supabase com conexão direta, Neon ou RDS; migration como passo de deploy. |
| E | LGPD: retenção, mascaramento dos dados enviados ao modelo e aviso de assistente virtual | Obrigatório antes de atender clientes reais. |
| F | Dados das versões anteriores: começar vazio ou migrar seletivamente | Ex.: exemplos de treinamento e memória de clientes. |

## Riscos conhecidos desta fatia

- **Sem limite de tentativas de login.** Adicionar rate limit por IP e por e-mail antes
  de abrir cadastro público.
- **SSRF na configuração da Evolution API.** O endereço da instância é configurável por
  administradores; validar HTTPS e bloquear redes internas antes de permitir o cadastro
  do canal pela interface.
- **Orçamento aproximado.** Duas execuções simultâneas podem ultrapassar o teto em uma
  chamada; aceitável para centavos, mas registrado.
- **Evolution sem idempotência no envio.** Se o processo cair depois de enviar e antes de
  gravar, a mensagem pode sair duas vezes pelo WhatsApp (a Resend deduplica).
- **Papel `suportfy_app` é global no cluster.** Bancos diferentes no mesmo servidor
  compartilham o papel; as políticas continuam por banco.

## Próximas fatias

1. **Webhooks e jobs.** Route Handlers para o webhook da Evolution (segredo por canal
   no endereço ou cabeçalho, comparação em tempo constante), job agendado que roda
   `runAgent` e `dispatchOutbox`, e fluxo de conexão do canal (validar credenciais →
   `connected`).
2. **Inbox real.** Listas de WhatsApp e E-mail, conversa e painel do cliente lendo do
   banco (os repositórios já existem e têm testes de isolamento). Retirar as ações de
   atendimento humano; mostrar estado do agente, motivos de erro e eventos.
3. **Shopify somente leitura.** Sincronizar clientes e pedidos por loja
   (`source = 'shopify'`), com versão de API fixa e webhooks assinados.
4. **Preferências do agente no servidor.** Modelo, teto diário e limites gravados em
   `ai_settings`, com validação da lista de modelos permitidos.
5. **Organizações:** convites, troca de organização/loja, papéis.
6. **Operação:** rate limit de login, monitoramento da fila, alertas de falha, LGPD e
   testes ponta a ponta.

## Próximo passo recomendado

Resolver a decisão D (hospedagem do Postgres) para ligar o backend na prévia da Vercel
e, em seguida, fazer a fatia 1 (webhooks e jobs) com uma instância de teste da
Evolution API.
