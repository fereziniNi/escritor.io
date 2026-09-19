-- Pedido do usuário: "não conseguimos editar e apagar algumas atividades" - apagar de verdade
-- (não arquivar) era impossível até agora porque `card_comentario`/`card_evento`/
-- `sessao_trabalho` referenciam `card` sem `ON DELETE CASCADE` - um `DELETE FROM card` batia em
-- violação de chave estrangeira. Troca as 3 FKs pra cascata, então apagar um card também apaga
-- seus comentários/histórico/sessões de trabalho junto (pedido explícito: "apagar de verdade -
-- remove tudo do banco"). `card_etiqueta`/`etiqueta` não entram aqui - já não existem mais
-- (feature de etiquetas removida numa migração anterior).

ALTER TABLE card_comentario DROP CONSTRAINT card_comentario_card_id_fkey;
ALTER TABLE card_comentario ADD CONSTRAINT card_comentario_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES card (id) ON DELETE CASCADE;

ALTER TABLE card_evento DROP CONSTRAINT card_evento_card_id_fkey;
ALTER TABLE card_evento ADD CONSTRAINT card_evento_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES card (id) ON DELETE CASCADE;

ALTER TABLE sessao_trabalho DROP CONSTRAINT sessao_trabalho_card_id_fkey;
ALTER TABLE sessao_trabalho ADD CONSTRAINT sessao_trabalho_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES card (id) ON DELETE CASCADE;
