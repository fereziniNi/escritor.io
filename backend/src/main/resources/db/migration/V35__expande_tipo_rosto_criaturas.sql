-- Usuário: "quero que voce aumente o numero de opções para a face. Acho que sao poucas que
-- trazem poucas diferenças" - as 8 opções originais eram só variação de formato humano (sutil
-- demais). O LPC tem cabeças bem mais distintas entre si fora do "humano" - adiciona 8: mais 1
-- variante humana (elderly_small) e 7 criaturas (alienígena/goblin/vampiro/lobo/coelho/orc/
-- minotauro), sem paleta de cor própria (as criaturas nem respondem a cor_pele - cor própria fixa,
-- ver mundo/spriteAvatar.ts).
ALTER TABLE usuario DROP CONSTRAINT ck_usuario_tipo_rosto;
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_tipo_rosto CHECK (tipo_rosto IN (
    'PADRAO', 'OVAL', 'ENVELHECIDA', 'OVAL_ENVELHECIDA', 'MAGRA', 'ROBUSTA', 'PEQUENA', 'OVAL_PEQUENA',
    'IDOSA_PEQUENA', 'ALIENIGENA', 'GOBLIN', 'VAMPIRO', 'LOBO', 'COELHO', 'ORC', 'MINOTAURO'
));
