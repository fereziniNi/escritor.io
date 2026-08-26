# Estratégia de testes e workflow TDD

## 1. Workflow por fatia incremental

Cada item do [plano incremental](incremental-plan.md) segue o mesmo ciclo, sempre começando pelo backend:

1. **Red (domínio):** escrever o teste da regra de negócio pura antes de qualquer código — ex.: "sequência `SAIDA` sem `ENTRADA` aberta é rejeitada". Sem Spring context.
2. **Green:** implementar o mínimo em `domain/` para passar.
3. **Refactor.**
4. **Red (camada web/repositório):** teste do endpoint (MockMvc + Spring Security test) ou do repositório (Testcontainers), cobrindo o contrato HTTP e as constraints de banco.
5. **Green → Refactor.**
6. **Frontend:** com o contrato de API já validado por teste no backend, escrever o teste de componente (RTL + MSW mockando a resposta) antes da implementação da tela/hook.
7. Fechar a fatia com um teste E2E **só se** o fluxo estiver na lista de críticos (§4).

Não se avança para o próximo item do backlog com testes vermelhos ou pulados.

---

## 2. Backend — pirâmide de testes

| Camada | Ferramenta | O que cobre | Sobe Spring context? | Sobe container? |
|---|---|---|---|---|
| Domínio (unitário) | JUnit 5 (+ AssertJ) | Cálculo de jornada/saldo, máquina de estados de marcação, encadeamento de hash SHA-256, regras de ordenação fracionária | Não | Não |
| Serviço (unitário) | JUnit 5 + Mockito | Orquestração de casos de uso com repositórios mockados | Não | Não |
| Repositório (integração) | `@DataJpaTest` + **Testcontainers** (Postgres real) | Mapeamento JPA, migrações Flyway reais, constraints de banco (ex.: `REVOKE UPDATE/DELETE` em `registro_ponto` realmente barra a operação) | Parcial (só JPA) | Sim |
| Web (integração) | `@WebMvcTest` + MockMvc + Spring Security Test | Contrato HTTP, status codes, autorização por papel, validação de payload | Parcial (só web) | Não |
| Ponta a ponta backend | `@SpringBootTest` + Testcontainers | Only para fluxos críticos completos (ex.: login → bater ponto → consultar jornada) | Sim | Sim |

**Por que Testcontainers e não H2:** o PRD depende de comportamento específico do Postgres (revogação de `UPDATE`/`DELETE` na tabela de ponto, `timestamptz`). H2 não replica isso fielmente e daria falso-positivo justamente no domínio mais sensível do sistema (ver ADR [0004](adr/0004-testcontainers.md)).

**Regra de prioridade (do PRD):** o cálculo de jornada e a validação de sequência de marcação são o código mais testado do projeto — cobertura de casos de borda ali (dias sem saída, marcações fora de ordem, pausas múltiplas) vale mais que cobertura ampla e rasa em outras áreas.

---

## 3. Frontend — pirâmide de testes

| Camada | Ferramenta | O que cobre |
|---|---|---|
| Unitário | Vitest | Funções puras de formatação/cálculo exibido (ex.: formatação de saldo em horas:minutos) |
| Componente | Vitest + React Testing Library + MSW | Comportamento de telas/hooks com API mockada — inclui o rollback otimista do kanban em caso de erro simulado |
| E2E | Playwright | Só os fluxos críticos (§4), contra backend real rodando localmente |

---

## 4. Fluxos cobertos por E2E

Lista fechada — adicionar um novo item aqui é uma decisão deliberada, não default:

- Login e bloqueio após 5 tentativas falhas.
- Ciclo completo de marcação de ponto (entrada → pausa → retomar → saída) e exibição correta do botão em cada estado.
- Solicitação de ajuste de ponto e aprovação pelo gestor.
- Drag-and-drop de card entre colunas, incluindo rollback visual quando a API falha.

---

## 5. Fora do escopo de teste automatizado (v1)

- Precisão de movimento do avatar no mapa (E5) — validado manualmente; a lógica de colisão no servidor tem teste unitário, mas a experiência de movimento em si não.
- Geração de PDF do espelho de ponto — teste cobre o conteúdo/dados, não o layout do PDF.
