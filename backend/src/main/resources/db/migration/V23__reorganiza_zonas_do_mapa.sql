-- Usuário não gostou do layout original (V21): as 3 salas ficavam todas espremidas numa única
-- fileira no topo do mapa (y=0..4), deixando o resto do mapa (a maior parte) como uma área aberta
-- vazia sem nenhuma organização. Reorganiza as salas espalhadas pelos cantos do mapa, com um
-- corredor/área central de verdade entre elas, e acrescenta uma 4ª sala (Recepção, tipo
-- ATENDIMENTO - já suportado pelo ck_zona_tipo, nenhuma migração de schema nova precisa).
--
-- UPDATE nas 3 zonas existentes (não DELETE+INSERT) de propósito: `evento_presenca` (V22) tem uma
-- FK NOT NULL pra `zona (id)` sem ON DELETE CASCADE - excluir as zonas antigas quebraria com
-- violação de FK contra qualquer evento de presença já gravado (o histórico de auditoria de quem
-- entrou/saiu de cada sala). Reposicionar mantendo o id/nome preserva esse histórico intacto - um
-- evento antigo continua dizendo corretamente "esteve na Sala de foco", só a definição espacial
-- da sala é que mudou.
UPDATE zona SET x = 1, y = 1, largura = 4, altura = 4
WHERE nome = 'Sala de foco' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET x = 14, y = 1, largura = 4, altura = 4
WHERE nome = 'Café' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

UPDATE zona SET x = 1, y = 9, largura = 5, altura = 5
WHERE nome = 'Sala de reunião' AND mapa_id IN (SELECT id FROM mapa WHERE ativo = true);

INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Recepção', 8, 1, 4, 3, 'ATENDIMENTO' FROM mapa WHERE ativo = true;
