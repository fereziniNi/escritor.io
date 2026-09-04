-- Usuário: "Adicione mais opções as que estão ainda não estão suficiente. Quero rostos humanos"
-- (depois da rodada anterior que só ampliou com criaturas). O LPC só tem 10 formatos de cabeça
-- humana no total (já usávamos 9) - as 6 novas são as mesmas 4 cabeças-base "padrão" compostas com
-- nariz + sobrancelha (overlays do próprio LPC, pré-compostos numa imagem só em build time, ver
-- mundo/spriteAvatar.ts), não formato de cabeça novo.
ALTER TABLE usuario DROP CONSTRAINT ck_usuario_tipo_rosto;
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_tipo_rosto CHECK (tipo_rosto IN (
    'PADRAO', 'OVAL', 'ENVELHECIDA', 'OVAL_ENVELHECIDA', 'MAGRA', 'ROBUSTA', 'PEQUENA', 'OVAL_PEQUENA',
    'IDOSA_PEQUENA', 'PADRAO_MARCANTE', 'PADRAO_DELICADO', 'OVAL_MARCANTE', 'OVAL_DELICADO',
    'ENVELHECIDA_MARCANTE', 'OVAL_ENVELHECIDA_MARCANTE',
    'ALIENIGENA', 'GOBLIN', 'VAMPIRO', 'LOBO', 'COELHO', 'ORC', 'MINOTAURO'
));
