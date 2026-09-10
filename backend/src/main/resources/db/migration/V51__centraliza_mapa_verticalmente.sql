-- Pedido do usuário: "O mapa na parte de baixo tem 4 quadrados sem nada e na parte de cima apenas
-- um. Adicione mais 5 quadrados na parte de cima para ficar centralizado o mapa."
--
-- Conferido: depois da V50 (mapa 36×22), as salas/cabines ocupam as linhas y=1 a y=17 - sobra 1
-- linha vazia acima (y=0) e 4 abaixo (y=18-21), exatamente como o usuário descreveu. Empurra tudo
-- 5 linhas pra baixo (y += 5, x intacto) e cresce a altura do mapa em 5 (22 -> 27) - o vão de baixo
-- continua do mesmo tamanho (4 linhas), só o de cima cresce de 1 pra 6.
UPDATE mapa SET altura_tiles = 27 WHERE ativo = true;

UPDATE zona SET y = y + 5
WHERE mapa_id IN (SELECT id FROM mapa WHERE ativo = true);
