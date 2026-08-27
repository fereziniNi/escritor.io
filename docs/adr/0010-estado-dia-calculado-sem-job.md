# ADR 0010 — Estado do dia (`ABERTA`/`FECHADA`/`INCONSISTENTE`) calculado na leitura, sem job agendado

## Status
Aceito

## Contexto
O plano incremental (S2.8) pede "Job/view que fecha o dia e marca `INCONSISTENTE` quando falta `SAIDA` até a virada". A leitura literal de "job" sugeria um `@Scheduled` rodando à meia-noite que persiste o novo estado em algum lugar. Antes de implementar, coloquei a decisão para revisão: job agendado com estado persistido vs. função pura calculada sob demanda.

## Decisão
Estado do dia é **derivado, nunca guardado**: `EstadoDia.calcular(registrosDoDia, fimDoDia, agora)` (`ponto/domain/EstadoDia.java`) olha só pra última marcação do dia e pro relógio atual — sem coluna de status, sem scheduler, sem `UPDATE` em lugar nenhum.

```java
if (ultima.tipo() == SAIDA) return FECHADA;
return agora.isBefore(fimDoDia) ? ABERTA : INCONSISTENTE;
```

## Alternativas consideradas
- **`@Scheduled` que persiste o status numa tabela (`FechamentoDia` ou coluna em outra tabela):** mais próximo da leitura literal de "job" do plano, mas introduz infraestrutura nova — fuso horário do agendamento, o que fazer se o processo estiver fora do ar exatamente na virada (dia fica com status desatualizado até o próximo restart), e mais um lugar que precisa de migração/teste de integração com tempo simulado. Também destoa do resto do domínio de ponto, que é propositalmente todo *append-only* e computado (`JornadaDiaria`, da slice S2.7, já é função pura pelo mesmo motivo).
- **View de banco (`CREATE VIEW`):** empurra a lógica pro SQL, difícil de testar com os mesmos casos de borda que `JornadaDiariaTest`/`EstadoDiaTest` já cobrem em Java puro, e ainda precisaria de uma fonte pra "agora" (função `now()` do Postgres) acoplando o teste ao relógio do banco.

## Consequências
- Nenhuma migração nova, nenhum scheduler, nenhum teste de integração com tempo — `EstadoDiaTest` roda em milissegundos como teste de unidade puro, mesmo estilo de `JornadaDiariaTest`.
- O estado é sempre a verdade *agora*: não existe janela em que o dia mostra um status desatualizado por causa de um job que não rodou. O custo é recalcular a cada leitura, mas a entrada é só a lista de marcações do dia (já teria que ser buscada de qualquer forma pra calcular `JornadaDiaria`).
- Quem consumir isso (S2.9 `GET /ponto/jornada-do-dia`, S2.14 espelho do mês) precisa fornecer o "fim do dia" e o "agora" explicitamente — normalmente `ZonedDateTime`/`Clock` já usados no resto do domínio de ponto (mesmo `Clock` injetado em `PontoService`, ver S2.4).
