-- Pedido do usuário: "pode eliminar no front e no back -> Solicitar ajuste de ponto". As duas
-- tabelas/coluna abaixo ficam vazias no momento desta migração (nenhuma solicitação de ajuste
-- jamais foi aprovada em nenhum ambiente até aqui) - dropar não descarta nenhum dado real, só o
-- esqueleto de uma funcionalidade que deixou de existir na aplicação (services/controllers/
-- entidades já removidos no mesmo commit).
ALTER TABLE registro_ponto DROP COLUMN substitui_id;
DROP TABLE solicitacao_ajuste_ponto;
