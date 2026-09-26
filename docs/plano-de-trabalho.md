# Plano de trabalho — Suportfy V4

Atualizado em 26/09/2026, após a segunda fatia do backend (WhatsApp de ponta a ponta). Detalhes técnicos em
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
- **Backend — canal WhatsApp (segunda fatia):**
  - Conectar, testar e desconectar uma instância da Evolution API pela interface, com
    estado real (conectado, aguardando QR code, erro com motivo).
  - Webhook `/api/webhooks/whatsapp/{canal}` autenticado pelo JWT HS256 que a própria
    Evolution API assina com a chave do canal; payload validado; eventos duplicados
    não duplicam mensagem nem resposta.
  - Mensagem recebida → persistência → agente com contexto só da loja (com pedidos) →
    outbox → envio pela Evolution API, com novas tentativas e lock por conversa.
  - Proteção contra SSRF nas chamadas ao provedor (inclui DNS rebinding).
  - Liga/desliga do atendimento automático por loja, gravado no servidor.
  - Atividade do canal (recebidas, enviadas, falhas, bloqueadas) e a última mensagem
    que o agente não respondeu, com o motivo.
- **Ainda demonstração:** Inbox, Visão geral, Clientes, Relatórios e as preferências do
  agente além do liga/desliga. E-mail e Shopify desconectados.
- **Depende de credenciais reais:** validar o fluxo com uma instância real da Evolution API
  e uma chave real da OpenAI (o ambiente de desenvolvimento bloqueia os dois domínios).

## Decisões tomadas

| # | Decisão | Situação |
| --- | --- | --- |
| 1 | WhatsApp via **Evolution API**, provedor já definido na interface do V4 | Adotado para esta fase. O adaptador isola o provedor; migrar para a Meta Cloud API continua possível e deve ser reavaliado pelo risco de bloqueio de número em API não oficial. |
| 2 | Banco próprio do V4 (PostgreSQL + RLS), com conceitos de isolamento da V2 reescritos | Implementado. Independe de Supabase (usa `app.user_id`, não `auth.uid()`). |
| 3 | Processamento dentro do app Next.js: fila no Postgres (outbox) + job agendado | Outbox e webhook implementados; o processamento roda logo após cada webhook (`after()`). Job periódico fica para depois. |
| 4 | Chave da OpenAI por organização, com substituição opcional por loja | Implementado (a interface ainda gerencia só a da organização). |
| 5 | Contrato do agente: saída JSON estrita; pedidos, rastreios e links citados precisam existir no contexto | Implementado (v1). |
| 6 | **Sem atendimento humano como fluxo de produto.** A IA atende; quando não pode responder com segurança, não envia e registra o motivo (`ai_status = 'error'`). | Decidido. O backend não tem atribuição, transferência nem fila de operadores. |
| 7 | Modo demonstração mantido quando não há `DATABASE_URL` | Implementado, para prévias sem banco. |
| 8 | Autenticidade do webhook da Evolution API pelo JWT HS256 nativo (`headers.jwt_key`), uma chave por canal | Implementado. É o mecanismo que o provedor oferece; não há HMAC do corpo. |

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
- **Sem job periódico.** Uma resposta que falhou temporariamente só é reenviada quando
  chega outra mensagem da mesma conversa. Um job curto (ex.: Vercel Cron a cada minuto
  chamando `dispatchOutbox`) resolve.
- **JWT do webhook sem proteção de replay dentro dos 10 minutos.** A reentrega do mesmo
  evento é inofensiva (idempotência), mas o token não é de uso único.
- **Formato não confirmado em instância real.** Endereços, eventos e o JWT foram
  conferidos no código-fonte da Evolution API v2, não numa instância em execução.
- **Orçamento aproximado.** Duas execuções simultâneas podem ultrapassar o teto em uma
  chamada; aceitável para centavos, mas registrado.
- **Evolution sem idempotência no envio.** Se o processo cair depois de enviar e antes de
  gravar, a mensagem pode sair duas vezes pelo WhatsApp (a Resend deduplica).
- **Papel `suportfy_app` é global no cluster.** Bancos diferentes no mesmo servidor
  compartilham o papel; as políticas continuam por banco.

## Próximas fatias

1. **Validar com credenciais reais.** Instância de teste da Evolution API e chave da
   OpenAI em um ambiente com banco hospedado (decisão D) e `SUPORTFY_PUBLIC_URL`.
2. **Job periódico.** Rota protegida chamada por agendamento (reenvio com backoff,
   mensagens que ficaram sem processar).
3. **Inbox real.** Listas de WhatsApp e E-mail, conversa e painel do cliente lendo do
   banco (os repositórios já existem e têm testes de isolamento). Retirar as ações de
   atendimento humano; mostrar estado do agente, motivos de erro e eventos.
4. **Shopify somente leitura.** Sincronizar clientes e pedidos por loja
   (`source = 'shopify'`), com versão de API fixa e webhooks assinados.
5. **E-mail (Resend)**, com recebimento, separado do WhatsApp.
6. **Preferências do agente no servidor** (modelo, teto diário, limites), organizações
   (convites, troca de loja) e operação (rate limit de login, alertas, LGPD).

## Próximo passo recomendado

Resolver a decisão D (hospedagem do Postgres), publicar com `SUPORTFY_PUBLIC_URL` e
conectar uma instância de teste da Evolution API com um número de teste — é o que falta
para ver uma resposta real chegando no WhatsApp.
