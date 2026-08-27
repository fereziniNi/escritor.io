# ADR 0009 — Papel de banco separado para runtime vs. migração

## Status
Aceito

## Contexto
O PRD (§3.2) pede que `UPDATE`/`DELETE` sejam revogados em `registro_ponto` para "o usuário da aplicação", chamando isso de "a garantia mais barata e mais forte que existe" no sistema de ponto. Ao implementar a fatia S2.1, descobri que isso não funciona da forma ingênua: no Postgres, o **dono** de uma tabela ignora qualquer `REVOKE` contra si mesmo — só um papel que não seja dono é de fato restringível. Como o backend, até então, rodava as migrações Flyway e servia requisições com o mesmo papel de banco (`presenca`), um `REVOKE UPDATE, DELETE ON registro_ponto FROM presenca` não teria efeito nenhum: `presenca` é quem cria a tabela, logo é o dono.

## Decisão
Dois papéis de banco, com responsabilidades que nunca se misturam:

- **`presenca`** — dono do schema, roda só o Flyway na subida da aplicação (`spring.flyway.*`). Nunca serve requisição nenhuma.
- **`presenca_app`** — papel de runtime, usado por `spring.datasource.*` (JPA/Hibernate, toda a aplicação em operação normal). Não é dono de nada, só tem os privilégios concedidos explicitamente.

O papel `presenca_app` é criado por um script (`backend/src/main/resources/db-init/criar-papel-app.sql`) que roda **antes** de qualquer migração Flyway — via `docker-entrypoint-initdb.d` no `docker-compose.yml` (dev) e via `PostgreSQLContainer.withInitScript(...)` do Testcontainers (testes). O script também configura `ALTER DEFAULT PRIVILEGES`, então toda tabela que o Flyway criar dali em diante já nasce com `SELECT/INSERT/UPDATE/DELETE` concedido a `presenca_app` automaticamente — sem precisar de `GRANT` manual tabela por tabela. A migração de `registro_ponto` (V8) então revoga `UPDATE`/`DELETE` especificamente:

```sql
REVOKE UPDATE, DELETE ON registro_ponto FROM presenca_app;
```

## Alternativas consideradas
- **Revogar do próprio papel que roda tudo:** não funciona, pelo motivo explicado no Contexto — dono ignora `REVOKE` contra si mesmo.
- **Row-level security / triggers de bloqueio:** mais flexível (permitiria, por exemplo, liberar `UPDATE` só para um papel de "admin de emergência"), mas é mais complexidade do que o projeto precisa agora — a separação de papéis já entrega a garantia que o PRD pede, com SQL padrão e sem lógica adicional para manter.
- **Grant manual tabela por tabela em vez de `ALTER DEFAULT PRIVILEGES`:** funciona, mas é fácil esquecer de conceder numa migração futura e descobrir o erro só em produção. `ALTER DEFAULT PRIVILEGES`, configurado uma vez no início, elimina essa categoria de erro.

## Consequências
- **Todo teste de repositório com Testcontainers precisou de `.withInitScript("db-init/criar-papel-app.sql")`** no `PostgreSQLContainer` — sem isso, qualquer migração que mexa em privilégios de `presenca_app` falha com "role does not exist". Isso já afeta todos os testes que rodam a suíte completa de migrações (basicamente todo `*RepositoryIT` e os `*ApplicationIT`/`*FilterIT`), não só os do domínio de ponto.
- **O teste que prova o `REVOKE` (`RegistroPontoRevogacaoIT`) não pode usar `@ServiceConnection`/`@DataJpaTest`** como os outros — essa infraestrutura sempre conecta com o papel administrador do container (dono das tabelas), então usar JPA ali provaria exatamente nada. O teste roda Flyway manualmente contra o container e abre uma conexão JDBC crua autenticada como `presenca_app`, para garantir que está testando o papel certo.
- **A pasta `postgres_data` do `docker-compose.yml` precisa estar vazia** na primeira subida para o script de `docker-entrypoint-initdb.d` rodar — Postgres só executa esses scripts quando o diretório de dados é criado do zero. Quem já tinha um volume de antes desta ADR precisa recriar o volume (`docker compose down -v`) para ganhar o papel `presenca_app`.
- Qualquer tabela futura que precise da mesma proteção (não é o caso hoje, mas poderia ser) só precisa de um `REVOKE` na própria migração — a concessão já vem de graça via `ALTER DEFAULT PRIVILEGES`.
