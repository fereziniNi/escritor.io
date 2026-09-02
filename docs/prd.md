# PRD — Sistema de Presença, Ponto e Tarefas

**Stack:** React (web desktop) + Spring Boot + PostgreSQL
**Escala:** até 10 usuários simultâneos
**Status do ponto:** registro interno auditável, **sem** pretensão de conformidade REP-P

---

## 1. Visão do produto

Um único ambiente onde a equipe registra jornada, enxerga quem está trabalhando em quê, e organiza as tarefas dos projetos. Três capacidades integradas:

1. **Ponto** — registro de jornada auditável, com carga diária flexível
2. **Tarefas** — quadros kanban combinando equipes e projetos
3. **Escritório virtual** — mapa 2D com avatares, como sinal social de disponibilidade

### Princípios de design

- **Presença no mapa ≠ ponto batido.** São dois sistemas independentes. Entrar no escritório virtual nunca registra ponto automaticamente, e sair do mapa nunca encerra jornada. Misturar os dois cria incentivo perverso (ficar parado no mapa para "provar" presença) e risco trabalhista.
- **Marcação de ponto é imutável.** Nunca se faz `UPDATE` ou `DELETE` numa marcação. Correção é uma solicitação aprovada que gera um novo registro apontando para o original.
- **Apontamento de horas em tarefa é gestão, não jornada.** A soma dos apontamentos não define a jornada — ela é comparada com a jornada para medir cobertura.

### Fora de escopo (v1)

- Áudio/vídeo por proximidade (WebRTC)
- Aplicativo mobile
- Conformidade REP-P (INPI, ICP-Brasil, AFD/AEJ, ATTR)
- Integração com folha de pagamento
- Editor visual de mapas (o mapa v1 é um JSON versionado no repositório)

---

## 2. Papéis e permissões

| Papel | Pode |
|---|---|
| **Colaborador** | Bater o próprio ponto, ver a própria jornada e saldo, solicitar ajuste, usar quadros das suas equipes/projetos, apontar horas, usar o mapa |
| **Gestor** | Tudo do colaborador + ver jornada e relatórios das suas equipes, aprovar/rejeitar ajustes, criar quadros e projetos |
| **Admin** | Tudo + gerenciar usuários, equipes, projetos, cargas horárias e mapa |

Regra de visibilidade dos quadros: o usuário enxerga quadros das equipes das quais é membro, mais quadros dos projetos aos quais suas equipes estão vinculadas.

---

## 3. Modelo de dados

### 3.1 Identidade e organização

```
Usuario
  id, nome, email (único)
  papel: COLABORADOR | GESTOR | ADMIN
  carga_diaria_minutos (ex.: 360 para 6h)
  ativo, criado_em

Equipe
  id, nome, descricao, ativa

MembroEquipe                      -- N:N
  equipe_id, usuario_id, papel_na_equipe (MEMBRO | LIDER)

Projeto
  id, nome, cliente, status: ATIVO | PAUSADO | CONCLUIDO
  inicio, fim_previsto

ProjetoEquipe                     -- N:N
  projeto_id, equipe_id
```

**Sem senha.** O login é passwordless: e-mail + código de acesso de uso único enviado por e-mail (ver `CodigoAcesso` abaixo). Não há `senha_hash` — não há segredo de longo prazo para vazar, phishing de senha ou reuso de senha entre sistemas para se preocupar.

```
CodigoAcesso
  id, usuario_id
  codigo_hash                     -- nunca o código em texto puro
  expira_em (timestamptz)
  usado_em (nullable)
  tentativas                      -- incrementa a cada verificação errada
  criado_em
```

### 3.2 Ponto (append-only)

```
RegistroPonto
  id
  usuario_id
  tipo: ENTRADA | SAIDA | PAUSA_INICIO | PAUSA_FIM
  momento (timestamptz)           -- instante da marcação
  origem: WEB | AJUSTE_APROVADO | ADMIN
  ip, user_agent
  solicitacao_id (nullable)       -- se veio de ajuste aprovado
  substitui_id (nullable)         -- registro original que este corrige
  hash_anterior, hash             -- encadeamento de integridade
  criado_em
```

**Encadeamento de integridade:** `hash = SHA-256(usuario_id | tipo | momento | origem | hash_anterior)`, onde `hash_anterior` é o hash do último registro daquele usuário. Qualquer alteração retroativa no banco quebra a cadeia e é detectável. É o que dá credibilidade ao registro sem o custo da certificação legal.

**Restrições de banco:** revogue `UPDATE` e `DELETE` na tabela para o usuário da aplicação. É a garantia mais barata e mais forte que existe aqui.

```
SolicitacaoAjustePonto
  id, usuario_id
  registro_alvo_id (nullable)     -- null = marcação esquecida
  tipo_solicitado, momento_solicitado
  justificativa
  status: PENDENTE | APROVADA | REJEITADA
  avaliador_id, avaliado_em, parecer

JornadaDiaria                     -- materializada por job ou view
  usuario_id, data
  minutos_trabalhados, minutos_pausa
  carga_prevista, saldo_minutos
  status: ABERTA | FECHADA | INCONSISTENTE
```

### 3.3 Kanban

```
Quadro
  id, nome
  projeto_id (nullable)
  equipe_id (nullable)
  arquivado
```

O escopo combinatório sai da nulidade dos dois campos:

| projeto_id | equipe_id | Significa |
|---|---|---|
| preenchido | preenchido | Quadro da equipe X dentro do projeto Y |
| preenchido | null | Quadro geral do projeto, visível a todas as equipes vinculadas |
| null | preenchido | Quadro interno da equipe, sem projeto |
| null | null | Inválido — bloquear por constraint |

```
Coluna
  id, quadro_id, nome, ordem, limite_wip (nullable)

Card
  id, coluna_id, titulo, descricao (markdown)
  ordem, responsavel_id (nullable), prazo (nullable)
  estimativa_minutos (nullable)
  criado_por, criado_em, arquivado

Etiqueta            id, quadro_id, nome, cor
CardEtiqueta        card_id, etiqueta_id
CardComentario      id, card_id, autor_id, texto, criado_em
CardEvento          id, card_id, autor_id, tipo, de, para, criado_em   -- histórico
```

Ordenação: use posição fracionária (`double precision` ou string lexicográfica tipo LexoRank). Reordenar um card vira um único `UPDATE`, não uma renumeração da coluna inteira.

### 3.4 Apontamento de horas

```
Apontamento
  id, usuario_id, card_id
  inicio, fim (nullable = timer rodando)
  minutos (calculado ao encerrar)
  descricao
  origem: TIMER | MANUAL
  criado_em, editado_em
```

Diferente do ponto, **apontamento é editável** — é dado de gestão, não de jornada. Regra: no máximo um timer aberto por usuário; iniciar um novo encerra o anterior.

### 3.5 Escritório virtual

```
Mapa
  id, nome, largura_tiles, altura_tiles, layout_json, ativo

Zona
  id, mapa_id, nome
  x, y, largura, altura
  tipo: FOCO | REUNIAO | CAFE | ATENDIMENTO | LIVRE

EventoPresenca                    -- opcional, só se quiser relatório de salas
  id, usuario_id, zona_id, entrou_em, saiu_em
```

Estado vivo (posição, status, última atividade) fica **em memória no servidor**, não no banco. Com 10 usuários isso é trivial e evita escrita constante em disco.

Status do avatar: `DISPONIVEL | FOCO | REUNIAO | ALMOCO | AUSENTE`. `AUSENTE` é automático após 5 minutos sem input.

---

## 4. Épicos e user stories

### E0 — Fundação
*Autenticação, cadastro organizacional, permissões.*

- Como **admin**, quero cadastrar usuários com carga diária, para que a jornada seja apurada corretamente.
- Como **admin**, quero criar equipes e projetos e vinculá-los entre si (N:N), para refletir a estrutura real da empresa.
- Como **usuário**, quero fazer login informando meu e-mail e o código de 6 dígitos que recebo por e-mail, e permanecer autenticado, para não reautenticar a cada acesso.

**Critérios de aceite (login):** login passwordless — sem senha cadastrada; código numérico de 6 dígitos, válido por 10 minutos, uso único; bloqueio do código após 5 tentativas erradas (força solicitar um novo); resposta de "solicitar código" é idêntica para e-mail existente ou não (não revela quais e-mails estão cadastrados); JWT de curta duração + refresh token; rotas protegidas por papel via Spring Security.

### E1 — Ponto ← *núcleo do MVP*

- Como **colaborador**, quero registrar entrada, pausa e saída em um clique, vendo meu estado atual, para não errar a marcação.
- Como **colaborador**, quero ver minha jornada do dia e o saldo acumulado, para saber quanto falta cumprir.
- Como **colaborador**, quero solicitar ajuste quando esquecer uma marcação, com justificativa, para corrigir sem que alguém edite o registro por baixo.
- Como **gestor**, quero aprovar ou rejeitar ajustes com parecer, para manter a apuração confiável.
- Como **colaborador**, quero ver o espelho do mês, para conferir antes do fechamento.

**Critérios de aceite (marcação):**
- O botão exibido depende do último registro (quem está em pausa só vê "Retomar")
- Sequências inválidas são rejeitadas (ex.: `SAIDA` sem `ENTRADA` aberta)
- Marcação gravada com `momento` do servidor, nunca do cliente
- Registro criado com hash encadeado ao anterior
- Dia sem `SAIDA` até a virada é marcado `INCONSISTENTE` e aparece como pendência para o colaborador

**Critérios de aceite (jornada flexível):**
- `minutos_trabalhados = Σ(SAIDA − ENTRADA) − Σ(PAUSA_FIM − PAUSA_INICIO)`
- `saldo = minutos_trabalhados − carga_diaria_minutos`
- Saldo acumulado é a soma dos saldos diários do período, ignorando dias não úteis

### E2 — Kanban ← *núcleo do MVP*

- Como **usuário**, quero ver os quadros das minhas equipes e projetos, para acessar só o que me diz respeito.
- Como **usuário**, quero arrastar cards entre colunas, com a mudança persistida e refletida para quem está online.
- Como **usuário**, quero criar cards com título, descrição, responsável, prazo e etiquetas.
- Como **usuário**, quero comentar em cards e ver o histórico de movimentações.
- Como **gestor**, quero definir limite de WIP por coluna, para evitar acúmulo em progresso.

**Critérios de aceite (drag-and-drop):** atualização otimista na UI; rollback visual se a API falhar; broadcast por WebSocket para os demais usuários do quadro; ordenação por posição fracionária.

### E3 — Apontamento de horas

- Como **usuário**, quero iniciar e parar um timer num card, para registrar tempo sem digitar.
- Como **usuário**, quero lançar tempo manualmente, para dias em que esqueci o timer.
- Como **gestor**, quero ver horas apontadas por projeto e por pessoa, para acompanhar esforço.

**Critério de aceite:** o painel do colaborador mostra jornada do dia × total apontado, sinalizando a diferença. A diferença é informativa — nunca bloqueia a saída.

### E4 — Relatórios

- Espelho de ponto individual do mês (PDF ou CSV)
- Saldo de horas por pessoa e por período
- Horas apontadas por projeto, por equipe e por card
- Pendências abertas: ajustes aguardando aprovação, dias inconsistentes

### E5 — Escritório virtual ← *deixar por último*

- Como **usuário**, quero entrar no mapa e mover meu avatar com as setas do teclado.
- Como **usuário**, quero ver quem está em cada sala e o status de cada um, para saber a hora de interromper.
- Como **usuário**, quero definir meu status manualmente (Foco, Reunião, Almoço).
- Como **usuário**, quero que entrar numa sala atualize meu status automaticamente (sala de Foco → status Foco).

**Critérios de aceite:**
- Movimento enviado ao servidor no máximo a cada 100 ms, com interpolação no cliente
- Servidor valida colisões — o cliente nunca é fonte de verdade sobre posição
- Reconexão automática do WebSocket com backoff exponencial

### E6 — Extras

Notificações in-app, exportação CSV geral, tema escuro, busca global de cards.

---

## 5. Roadmap sugerido

| Fase | Escopo | Entregável |
|---|---|---|
| 1 | E0 + E1 | Time bate ponto e vê saldo — já é útil sozinho |
| 2 | E2 | Quadros substituem o Trello |
| 3 | E3 + E4 | Gestão de esforço e relatórios |
| 4 | E5 | Escritório virtual |

Cada fase deve ir para produção antes da seguinte começar. Isso vale mais que a ordem em si: você descobre o que a equipe realmente usa antes de investir na parte cara.

---

## 6. Decisões técnicas

- **WebSocket:** Spring WebSocket nativo com um handler por domínio (`/ws/presenca`, `/ws/quadro/{id}`). STOMP só se quiser roteamento por tópico pronto — com 10 usuários, não é necessário.
- **Fuso horário:** persistir tudo em `timestamptz` (UTC), converter para `America/Sao_Paulo` só na apresentação.
- **Migrações:** Flyway desde o primeiro commit.
- **Mapa:** `layout_json` versionado no repositório na v1; editor visual só se houver demanda real.
- **Frontend:** React + TypeScript, dnd-kit para o kanban, react-konva ou canvas puro para o mapa.
- **Testes:** priorize o cálculo de jornada e a validação de sequência de marcações. É onde bug custa caro e onde a lógica é mais sutil.
- **E-mail (login):** Spring Mail (SMTP) atrás de uma interface própria, para trocar de provedor sem tocar no fluxo de login. Em dev/teste, Mailpit local via docker-compose captura os e-mails sem enviar nada de verdade; produção aponta para um SMTP real (a decidir quando houver deploy).
