# Plano de trabalho — Suportfy V4

Atualizado em 25/09/2026, após a auditoria somente de leitura das versões anteriores
(`suport-fy`, `suportfybr`, `suportfy-v2` e `suportfy-whatsapp`). As versões anteriores
são referência de aprendizado, não especificação: nenhum código foi copiado.

## Onde estamos

- Frontend demonstrativo navegável entregue na branch `claude/youthful-fermi-y1oi9q`
  (PR #1): Inbox orientada à supervisão da IA, páginas operacionais, agente de IA,
  conhecimento, automações, relatórios, equipe e 21 seções de configurações.
- Nenhum backend, autenticação, persistência ou integração real.

## Lições das versões anteriores que orientam o V4

1. **Segredos nunca chegam ao navegador.** As versões antigas guardavam chaves de
   OpenAI, Resend, Shopify e WhatsApp em tabelas lidas pelo frontend. No V4, segredos
   ficam cifrados em schema não exposto, gravados por fluxo só de escrita, com o
   navegador vendo apenas um indicador (`configurada`, data e últimos caracteres).
2. **Isolamento por organização e loja provado por teste.** Policies `USING (true)`,
   `store_id` vindo do corpo ou da URL e funções com service role sem checar o chamador
   foram os erros mais graves. RLS por papel e testes automatizados de RLS são requisito.
3. **Persistir antes de enviar, com idempotência real.** Mensagem registrada, job
   enfileirado e só então o provedor é chamado; eventos de provedor deduplicados por ID.
4. **"Nunca inventar" precisa ser validação, não só texto de prompt.** Status de pedido,
   rastreio e prazos só saem de ferramentas no servidor; a resposta do modelo é
   estruturada e conferida antes do envio.
5. **Travas antes de qualquer chamada de IA.** Anti-loop (e-mails automáticos, própria
   loja, eco da última resposta, limite sem informação nova), orçamento e kill switch.
6. **Falhas visíveis.** Filas com motivo de erro, itens presos devolvidos, alerta quando
   o agente para de processar. Uma fila das versões antigas ficou parada por erro de
   inicialização sem ninguém perceber.
7. **Idioma e persona por loja**, sem padrões fixos em inglês nem persona hardcoded.
8. **Aprendizado com aprovação.** Correções da equipe e sugestões de prompt só passam a
   valer depois de revisadas.
9. **Processo:** um gerenciador de pacotes, migrations que recriam o banco do zero, CI
   com banco, README verdadeiro e PRs pequenos.

## Decisões pendentes antes de integrações reais

| # | Decisão | Por que importa |
| --- | --- | --- |
| 1 | Provedor de WhatsApp: Evolution API (não oficial) ou Meta Cloud API (oficial) | As versões recentes migraram para a Meta. Automação em massa em API não oficial traz risco de bloqueio do número. |
| 2 | Base do backend: portar o modelo de dados e de segurança da V2 para o V4 ou começar outro | A V2 tem a fundação multi-tenant mais sólida, mas não modela o atendimento por IA. |
| 3 | Onde roda o processamento (rotas do Next.js com fila no Postgres, Edge Functions com `pg_cron` ou worker dedicado) | Define confiabilidade, custo e observabilidade do agente. |
| 4 | Escopo da chave OpenAI: por organização, com ou sem substituição por loja | Afeta cobrança, limites e isolamento. |
| 5 | Contrato do agente: ferramentas permitidas, formato de saída, validações e critérios de encaminhamento | É o que impede respostas inventadas. |
| 6 | Critério para ligar o modo automático (período em copiloto, métricas mínimas) | Evita colocar em produção sem evidência de qualidade. |
| 7 | Dados das versões anteriores: começar vazio ou migrar seletivamente | Exemplos de treinamento e memória de clientes podem ter valor. |
| 8 | LGPD: retenção, mascaramento de dados enviados ao modelo e aviso de assistente virtual | Obrigatório antes de atender clientes reais. |

## Fases

### Fase 0 — Ajustes do frontend a partir da auditoria (proposta, aguardando aprovação)

- Motivos de encaminhamento que o agente pode registrar: e-mail automático ignorado,
  limite de respostas sem informação nova, pedido não encontrado, fonte ausente.
- Aviso de saúde da fila do agente na Visão geral (processamento parado, falhas recentes).
- Fila de aprovação para correções da equipe e sugestões de prompt.
- Idioma detectado da conversa no cabeçalho e no painel do cliente.
- Registro de execução da IA na conversa (ferramentas consultadas, tempo, custo),
  discreto e recolhível.
- Metadados de segredo na tela de IA para o estado real (configurada por, data, final).

### Fase 1 — Decisões de arquitetura

Registrar as decisões da tabela acima em documentos curtos (um por decisão), com
alternativas e consequências.

### Fase 2 — Fundação do backend

Autenticação, organizações, lojas, membros e papéis; RLS por papel e loja; migrations
reproduzíveis; testes de RLS; CI com banco; validação de variáveis de ambiente.

### Fase 3 — Segredos e integrações de leitura

Chave da OpenAI cifrada e só de escrita, teste de conexão no servidor; Shopify somente
leitura com versão de API fixada; e-mail (Resend) e WhatsApp conforme a decisão 1;
webhooks com assinatura, falhando fechados e idempotentes.

### Fase 4 — Pipeline do agente de IA

Recebimento → agrupamento de mensagens → travas (anti-loop, orçamento, pausa) →
contexto com ferramentas controladas → resposta estruturada com fontes → validação →
persistência → envio por fila → status de entrega. Encaminhamento com motivo e regra.
Registro de cada execução. Começa em copiloto; automático após o critério da decisão 6.

### Fase 5 — Conhecimento e aprendizado supervisionado

Conteúdo publicado e versionado como única fonte do agente; correções da equipe com
aprovação.

### Fase 6 — Automações, SLA e relatórios reais

### Fase 7 — Produção

Monitoramento, alertas de fila, LGPD, testes ponta a ponta e implantação.

## Próximo passo recomendado

Resolver as decisões 1 a 5 com o responsável pelo produto e, em paralelo, aprovar ou
ajustar a lista da Fase 0. Só depois iniciar a Fase 2.
