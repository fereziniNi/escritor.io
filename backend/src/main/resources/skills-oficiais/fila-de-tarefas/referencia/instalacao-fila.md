# Instalação da fila de tarefas (para a skill instalacao-docker-compose)

O compose de produção roda **a mesma imagem** em três serviços, diferenciados só por `ROLE`. Valores fixos:

| Serviço | `ROLE` | Porta | Quando | Observação |
|---|---|---|---|---|
| `migracao` | `migrar` | nenhuma | uma vez por deploy, antes dos outros (`restart: "no"`, `depends_on: postgres healthy`) | usa `DATABASE_URL` (o **dono**); roda `migrarBanco` e `prepararFila` e termina |
| `api` | `api` | 3000 (atrás do Caddy) | sempre | usa só `DATABASE_URL_RUNTIME`; `depends_on: migracao completed_successfully` |
| `worker` | `worker` | nenhuma | sempre | usa só `DATABASE_URL_RUNTIME` e `ALERTA_EMAIL`; `depends_on: migracao completed_successfully` |

Servidor pequeno: um único serviço `api` com `ROLE=tudo` (precisa de `ALERTA_EMAIL`), sem `worker`. Nunca duas réplicas de `api` com `tudo`
para escalar: escale o `worker`.

Trechos do compose (ajuste nomes e segredos ao projeto):

```yaml
services:
  migracao:
    image: ${IMAGEM_APP}
    command: ["node", "dist/main.js"]
    environment:
      ROLE: migrar
      NODE_ENV: production
      DATABASE_URL_ARQUIVO: /run/secrets/database_url        # o DONO do banco
    secrets: [database_url]
    restart: "no"
    depends_on:
      postgres: { condition: service_healthy }

  api:
    image: ${IMAGEM_APP}
    environment:
      ROLE: api
      NODE_ENV: production
      DATABASE_URL_ARQUIVO: /run/secrets/database_url
      DATABASE_URL_RUNTIME_ARQUIVO: /run/secrets/database_url_runtime
    depends_on:
      migracao: { condition: service_completed_successfully }

  worker:
    image: ${IMAGEM_APP}
    environment:
      ROLE: worker
      NODE_ENV: production
      ALERTA_EMAIL: ti@grupomultiplica.com.br
      FILA_ENCERRAR_TIMEOUT_S: "30"
      DATABASE_URL_ARQUIVO: /run/secrets/database_url
      DATABASE_URL_RUNTIME_ARQUIVO: /run/secrets/database_url_runtime
    stop_grace_period: 45s        # MAIOR que FILA_ENCERRAR_TIMEOUT_S: o SIGTERM espera as tarefas em andamento
    depends_on:
      migracao: { condition: service_completed_successfully }
```

Regras:

1. `api` e `worker` recebem `DATABASE_URL` (o schema de configuração a exige) e `DATABASE_URL_RUNTIME` (é por ela que conectam). Só a `migracao` usa o dono para DDL; o mesmo vale para as tarefas: nenhum DDL em runtime.
2. O `worker` não escuta porta: não tem `healthcheck` HTTP. Monitore pelo log (`level: error` com `[fila]`) e pelo e-mail de `ALERTA_EMAIL`.
3. `stop_grace_period` do `api` também deve ser maior que `FILA_ENCERRAR_TIMEOUT_S` (a API para a fila no SIGTERM).
4. Toda tarefa nova exige redeploy com a `migracao` (cria a fila). Sem isso, o `worker` não sobe e o log diz para rodar o passo de migração.
5. Backup: o schema `fila` está no mesmo banco, então o backup do Postgres já o cobre. Tarefas pendentes voltam junto com a restauração.
6. SMTP, `MAIL_MODE=smtp`, `ALERTA_EMAIL` e o segredo do link do armazenamento valem para o `worker` também: ele envia e-mail.
