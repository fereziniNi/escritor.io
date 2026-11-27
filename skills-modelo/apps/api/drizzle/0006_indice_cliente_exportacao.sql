-- Skill exportacao-excel-pdf-csv: índice da leitura em lotes por chave (criado_em, id) do exemplo de exportação de clientes.
-- Sem ele, cada lote ordenaria a tabela inteira; com ele a consulta lê só os 500 próximos pela ordem do índice.
CREATE INDEX "cliente_criado_em_id_desc" ON "cliente" ("criado_em" DESC, "id" DESC);
