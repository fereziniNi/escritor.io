-- Pedido do usuário: "adicionar mais informações no relatório diário, mas deixe personalizado
-- para o admin / conseguir visualizar as possibilidades de filtros que poderá utilizar" - o admin
-- passa a escolher quais blocos entram no resumo (V29 só tinha horário/habilitado, sem nenhuma
-- opção de conteúdo). `incluir_ponto`/`incluir_tarefas_criadas_movidas` nascem `true` porque são
-- o comportamento de hoje (preserva o que quem já configurou já está recebendo); os três blocos
-- novos nascem `false` até o admin ligar de propósito.
ALTER TABLE configuracao_relatorio_diario
    ADD COLUMN incluir_ponto BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN incluir_tarefas_criadas_movidas BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN incluir_tarefas_concluidas BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN incluir_reunioes BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN incluir_ausencias BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN incluir_resumo_equipe BOOLEAN NOT NULL DEFAULT false;
