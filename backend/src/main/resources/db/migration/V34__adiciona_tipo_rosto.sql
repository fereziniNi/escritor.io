-- Categoria "Face" (formato do rosto/cabeça) - pedida pelo usuário depois da virada pra pixel art
-- real (LPC): "quero poder escolher qual face irei utilizar... quero poder trocar o rosto". Sem
-- paleta de cor própria (reaproveita cor_pele, mesmo padrão de tipo_barba/cor_cabelo).
ALTER TABLE usuario ADD COLUMN tipo_rosto VARCHAR(20) NOT NULL DEFAULT 'PADRAO';

ALTER TABLE usuario ADD CONSTRAINT ck_usuario_tipo_rosto CHECK (tipo_rosto IN (
    'PADRAO', 'OVAL', 'ENVELHECIDA', 'OVAL_ENVELHECIDA', 'MAGRA', 'ROBUSTA', 'PEQUENA', 'OVAL_PEQUENA'
));
