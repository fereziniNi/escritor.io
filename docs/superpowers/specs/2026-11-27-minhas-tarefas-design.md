# Minhas tarefas — design

Data: 27/11/2026 · Tamanho: mudança pequena a média (uma tela nova, 3 endpoints, 1 migração aditiva)

## Intenção e por quê

Hoje cada tarefa (card) mora no quadro de um projeto. Quem trabalha em vários projetos precisa
entrar em um por um para ver e atualizar o que está fazendo. O pedido: **uma lista única de
afazeres**, em que cada item diz de qual projeto é, para ver tudo o que há para fazer e em que
estado está, de uma vez.

O pedido é de visão pessoal: o Carlos (admin) **não usa os quadros** hoje. Não há outra pessoa
cuja rotina dependa de os quadros continuarem do jeito que estão.

## Objetivos

- Tela **Minhas tarefas** com todos os cards em que a pessoa é responsável, de todos os projetos.
- Cada item mostra o projeto como etiqueta colorida, o prazo e o estado.
- Criar tarefa direto na lista, escolhendo o projeto (ou nenhum).
- Mudar o estado de uma tarefa sem abrir o projeto.
- Ter tarefas **sem projeto** (ex.: "ligar para o contador").

## Não-objetivos

- Não remover nem alterar a tela de quadros. Esconder ou aposentar os quadros é decisão futura.
- Sem visão de equipe, sem arrastar e soltar, sem tarefas recorrentes.
- Sem atualização ao vivo (WebSocket) na primeira versão: a lista recarrega ao abrir a tela e ao
  voltar o foco para a aba.

## Anti-objetivos (seria falha mesmo funcionando)

- Perder ou duplicar dados: cronômetro, comentários, histórico e relatórios de horas continuam
  apontando para o mesmo card.
- **Vazar tarefa pessoal.** Hoje criar card avisa todos os usuários e manda WhatsApp ao admin com
  título e projeto. Uma tarefa sem projeto nunca pode gerar isso.

## Constraints do código atual

- `Card` pertence a `Coluna`, que pertence a `Projeto` (ambos obrigatórios).
- Visibilidade de projeto = ser membro (`MembroProjeto`); não há bypass de ADMIN em
  `listarVisiveis` / `usuarioPodeVer`.
- `CardService.criar` e `.mover` disparam notificação a todos e WhatsApp ao admin.
- `CardService.mover` não deixa mover entre projetos e respeita limite de tarefas em andamento
  (`LimiteWipExcedidoException`).
- "Finalizar" (com descrição) é do cronômetro (`POST /cards/{id}/cronometro/finalizar`) e só grava
  `concluidoEm` + descrição; não move a coluna.

## Abordagens consideradas

1. **Tela sobre os cards existentes (escolhida).** Nova tela e novos endpoints leem/gravam os
   mesmos cards. Sem migração destrutiva; cronômetro e relatórios intactos.
2. To-do independente (nova entidade, quadros abandonados). Descartada: cronômetro e relatórios
   de horas dependem de card e projeto; seria refazer isso, com risco para o histórico.

Para tarefas sem projeto:

1. **Projeto pessoal escondido, um por pessoa (escolhida).** Criado na primeira tarefa solta,
   com as mesmas 3 colunas dos outros.
2. Permitir card sem coluna. Descartada: colunas, limite de tarefas, relatórios e visibilidade
   passam todos pelo projeto.

## Decisões do usuário

- Visão apenas pessoal. Layout **A: agrupado por estado** (Em andamento, A fazer, Feito), com o
  projeto como etiqueta colorida no item.
- Tarefa sem projeto = projeto pessoal escondido.

## Decisões minhas (o usuário pode trocar)

1. **Estado vem da posição da coluna** no projeto: primeira = A fazer, última = Feito, do meio =
   Em andamento. Projeto com 1 coluna: tudo A fazer. Com 2: só A fazer e Feito. Também é Feito
   quem tem `concluidoEm` preenchido, mesmo fora da última coluna.

   > **Emendado (estado por nome):** a regra posicional não resistiu aos quadros reais, que não seguem
   > a ordem A fazer / Em andamento / Feito (ex.: `Fazendo, Feito, Backlog`, com Backlog por último e Feito
   > no meio; ou um único `Fazendo`): Backlog aparecia como Feito, Feito como Em andamento e a troca de
   > estado falhava com 400. Agora o estado vem do **nome da coluna** (Feito/Concluído, Fazendo/Andamento,
   > A fazer/Backlog/Pendente...), com a posição só como fallback para nomes não reconhecidos. A troca
   > de estado move para a primeira coluna cujo nome representa o destino, e a API expõe
   > `estadosDisponiveis` para o front mostrar só as etapas que o projeto tem.

   > **Emendado (o seletor sempre funciona):** escolher um estado que o projeto não tem cria a coluna
   > padrão automaticamente, só se quem pede vê o projeto (senão continua 400): nome = "A fazer",
   > "Em andamento" ou "Feito"; `ordem` = menor existente - 1 para A fazer (nova primeira coluna) e
   > maior existente + 1 para Em andamento/Feito (no fim); sem limite WIP. Por isso
   > `estadosDisponiveis` agora traz sempre os três estados e o front mostra o seletor completo e
   > habilitado (só desabilitado em tarefa finalizada). Não existe botão "Concluir" na lista.
2. Entram só cards com **responsável = eu** e não arquivados. Card sem responsável não aparece.
3. Ordem dentro do grupo: prazo mais próximo primeiro, sem prazo por último, depois mais antigo.
   Prazo de hoje ou vencido aparece em vermelho.
4. **Feito** vem recolhido e mostra as **20 mais recentes** (por data de conclusão; sem data, pelo id). *Ajustado ao planejar: "últimos 14 dias" exigia uma data que cards movidos à mão para a última coluna não têm.*
5. Trocar o estado na lista usa o `mover` existente para a coluna correspondente (a primeira
   coluna do meio, se houver várias). Erro de limite de tarefas é mostrado ao usuário. Mover
   para Feito **não** pede a descrição de conclusão nem grava `concluidoEm`; a finalização formal
   (descrição, cronômetro) continua dentro do card. Tarefa já finalizada formalmente (com
   `concluidoEm`) conta como Feito e **não muda de estado pela lista** (resposta 409).
6. **Nova tarefa:** título obrigatório, projeto (padrão: "Sem projeto"), prazo e estimativa
   opcionais. Nasce na primeira coluna, com responsável = quem criou.
7. **Projeto pessoal:** nova coluna `projeto.pessoal_de_usuario_id` (nulo nos projetos normais,
   único por pessoa), migração **V60**. Fica fora de `listarVisiveis`, de `ProjetosPage`, do
   painel de projetos do escritório e dos filtros de relatório. O dono é o único membro.
8. **Tarefa pessoal não notifica ninguém:** sem aviso na tela, sem central de notificações, sem
   WhatsApp, em criar, mover e finalizar. Tarefas de projeto normal mantêm os avisos de hoje.
9. **Painel do dock** "✅ Minhas tarefas" (a tela do app é o Escritório com painéis, não há rotas; *corrigido ao planejar*). Os endpoints novos (`GET /tarefas/minhas`,
   `POST /tarefas`, `PATCH /tarefas/{cardId}/estado`) reaproveitam `CardService`.
10. Horas de tarefas pessoais somam no projeto pessoal; ele não aparece nos filtros por projeto.
    Elas continuam no total de horas da pessoa.

## Para quem constrói decidir

- Como abrir o card completo a partir da lista: reaproveitar o componente do detalhe do card
  se ele existir fora da página do projeto; senão extrair.
- Nomes exatos, cores das etiquetas (estáveis por projeto) e textos.
- Estratégia de cache/refetch no frontend.

## Testes esperados

- Mapeamento de estado (1, 2 e N colunas; `concluidoEm` fora da última coluna).
- Criação de tarefa sem projeto cria o projeto pessoal uma vez só e reaproveita.
- Projeto pessoal não aparece em listas, e nenhuma notificação/WhatsApp é emitida para ele.
- Mudança de estado respeita limite de tarefas em andamento e membros do projeto.
- Migração V60 aplicada sobre o schema de produção (59 migrações).
