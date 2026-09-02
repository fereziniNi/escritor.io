-- Pedido do cliente (via usuário): "Remova a etiqueta" - etiqueta some por completo do sistema
-- (front, back e banco). Verificado no Postgres real de dev antes desta migração: `etiqueta` e
-- `card_etiqueta` estavam com 0 linhas cada, então não há dado nenhum pra preservar/migrar aqui,
-- diferente de V27 (que precisou de backfill).

-- ordem importa: card_etiqueta referencia etiqueta, precisa sumir antes dela.
DROP TABLE card_etiqueta;
DROP TABLE etiqueta;
