# Migração do índice da leitura em lotes

A exportação lê os clientes em lotes de 500 paginando por chave (`criado_em desc, id desc`, regra 10). Sem um índice nessa
ordem, **cada lote ordena a tabela inteira** (custo cresce com as linhas e se repete a cada 500). Com o índice, cada lote lê
só os próximos 500 pela ordem dele. Vale para qualquer recurso que você exportar: crie o índice na mesma ordem da paginação.

Esta migração é SQL à mão (o índice com `DESC` na ordem da chave não sai do esquema do exemplo). Crie a migração vazia e cole o SQL:

```bash
pnpm --filter api exec drizzle-kit generate --custom --name=indice_cliente_exportacao
```

Ela cria `apps/api/drizzle/<número>_indice_cliente_exportacao.sql` (no modelo, `0006`, depois do `0005_cliente` da skill
`lgpd-dados-pessoais`). Substitua o conteúdo por:

<!-- arquivo: skills-modelo/apps/api/drizzle/0006_indice_cliente_exportacao.sql -->
```sql
-- Skill exportacao-excel-pdf-csv: índice da leitura em lotes por chave (criado_em, id) do exemplo de exportação de clientes.
-- Sem ele, cada lote ordenaria a tabela inteira; com ele a consulta lê só os 500 próximos pela ordem do índice.
CREATE INDEX "cliente_criado_em_id_desc" ON "cliente" ("criado_em" DESC, "id" DESC);
```

Confira com `pnpm --filter api db:migrate` e `EXPLAIN` da consulta de `lotesParaExportar`: sem `Sort`, só `Index Scan` no
`cliente_criado_em_id_desc`.
