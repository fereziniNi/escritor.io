-- Usuário pediu um redesign completo inspirado numa referência visual de escritório virtual bem
-- mais rico/denso, com 4 salas organizadas por função: Reuniões, Pausa/Café, Trabalhando, Fora do
-- trabalho. Reaproveita os 4 tipos de zona já existentes (nenhuma migração de schema nova):
-- REUNIAO/CAFE já existiam com esse sentido; FOCO passa a representar a sala principal de trabalho
-- (grande, com várias baias) e LIVRE (livre = "fora do expediente") passa a ser a sala de descanso/
-- lounge, no lugar de Recepção (ATENDIMENTO), que não fazia parte do pedido de 4 salas.
--
-- Mapa cresce de 20×15 pra 28×20 - as 4 salas do jeito novo (mais espaçosas, no espírito da
-- referência) não cabiam confortavelmente com corredor de verdade entre elas no tamanho antigo.
-- Crescer o mapa é seguro pra quem já está conectado: os limites antigos são um subconjunto dos
-- novos, nenhuma posição válida anterior fica inválida.
--
-- Mesmo cuidado de V23: UPDATE nas 4 zonas existentes por nome (não DELETE+INSERT) - `evento_presenca`
-- tem FK NOT NULL pra `zona(id)` sem ON DELETE CASCADE, e já existem linhas de auditoria reais no
-- banco de dev. Reposicionar/renomear mantendo o id preserva o histórico e a integridade referencial.
UPDATE mapa SET largura_tiles = 28, altura_tiles = 20 WHERE ativo = true;

UPDATE zona SET nome = 'Sala de reunião', x = 1, y = 1, largura = 7, altura = 6
WHERE nome = 'Sala de reunião' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET nome = 'Café', x = 13, y = 1, largura = 6, altura = 6
WHERE nome = 'Café' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET nome = 'Área de trabalho', x = 1, y = 10, largura = 12, altura = 8
WHERE nome = 'Sala de foco' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET nome = 'Fora do trabalho', tipo = 'LIVRE', x = 16, y = 10, largura = 10, altura = 8
WHERE nome = 'Recepção' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);
