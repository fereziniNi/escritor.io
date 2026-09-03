ALTER TABLE usuario DROP CONSTRAINT ck_usuario_estilo_roupa;
ALTER TABLE usuario DROP COLUMN estilo_roupa;
ALTER TABLE usuario DROP COLUMN cor_roupa;

ALTER TABLE usuario DROP CONSTRAINT ck_usuario_tipo_barba;
ALTER TABLE usuario ALTER COLUMN tipo_barba SET DEFAULT 'NENHUM';

-- EstiloCabelo ganhou mais constantes nesta expansão (perdeu MEDIO, ganhou várias outras) -
-- quem já tinha MEDIO salvo precisa migrar pra um valor válido antes do CHECK novo entrar em
-- vigor, senão a constraint abaixo falha pra essas linhas.
UPDATE usuario SET estilo_cabelo = 'CURTO' WHERE estilo_cabelo = 'MEDIO';

ALTER TABLE usuario DROP CONSTRAINT ck_usuario_estilo_cabelo;
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_estilo_cabelo CHECK (estilo_cabelo IN (
    'CARECA', 'RASPADO', 'CURTO', 'REPARTIDO', 'CACHEADO', 'MOICANO', 'RABO_DE_CAVALO', 'CHIQUINHAS', 'LONGO', 'COQUE', 'ESPETADO'
));

ALTER TABLE usuario
    ADD COLUMN estilo_top VARCHAR(20) NOT NULL DEFAULT 'CAMISETA',
    ADD COLUMN cor_top VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    ADD COLUMN estilo_jaqueta VARCHAR(20) NOT NULL DEFAULT 'NENHUMA',
    ADD COLUMN cor_jaqueta VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    ADD COLUMN estilo_bottom VARCHAR(20) NOT NULL DEFAULT 'CALCA',
    ADD COLUMN cor_bottom VARCHAR(7) NOT NULL DEFAULT '#2b2b3a',
    ADD COLUMN estilo_sapato VARCHAR(20) NOT NULL DEFAULT 'TENIS',
    ADD COLUMN cor_sapato VARCHAR(7) NOT NULL DEFAULT '#1c1a28',
    ADD COLUMN cor_chapeu VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    ADD COLUMN cor_oculos VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    ADD COLUMN estilo_outro VARCHAR(20) NOT NULL DEFAULT 'NENHUM',
    ADD COLUMN cor_outro VARCHAR(7) NOT NULL DEFAULT '#6b7280';

ALTER TABLE usuario ADD CONSTRAINT ck_usuario_tipo_barba CHECK (tipo_barba IN (
    'NENHUM', 'BIGODE_FINO', 'BIGODE_GROSSO', 'CAVANHAQUE', 'SUICAS', 'BARBA_CURTA', 'BARBA_CHEIA', 'CAVANHAQUE_BIGODE'
));
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_estilo_top CHECK (estilo_top IN (
    'CAMISETA', 'REGATA', 'POLO', 'CAMISA', 'SUETER', 'LISTRADA', 'GOLA_V', 'GOLA_ALTA', 'MOLETOM_LEVE'
));
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_estilo_jaqueta CHECK (estilo_jaqueta IN (
    'NENHUMA', 'JEANS', 'BLAZER', 'MOLETOM_CAPUZ', 'COLETE', 'CASACO_LONGO', 'BOMBER', 'CARDIGA', 'COURO'
));
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_estilo_bottom CHECK (estilo_bottom IN (
    'CALCA', 'JEANS', 'LEGGING', 'SHORT', 'BERMUDA', 'SHORT_JEANS', 'SAIA', 'SAIA_LONGA', 'CALCA_LISTRADA'
));
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_estilo_sapato CHECK (estilo_sapato IN (
    'TENIS', 'SOCIAL', 'BOTA', 'BOTA_CANO_ALTO', 'SANDALIA', 'CHINELO', 'SALTO', 'DESCALCO'
));
ALTER TABLE usuario DROP CONSTRAINT ck_usuario_chapeu;
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_chapeu CHECK (chapeu IN (
    'NENHUM', 'BONE', 'BONE_LATERAL', 'GORRO', 'CHAPEU_PRAIA', 'BANDANA', 'FAIXA', 'CARTOLA', 'CAPACETE', 'TIARA'
));
ALTER TABLE usuario DROP CONSTRAINT ck_usuario_oculos;
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_oculos CHECK (oculos IN (
    'NENHUM', 'REDONDO', 'QUADRADO', 'AVIADOR', 'ESCUROS', 'CORACAO', 'ESTRELA', 'MEIA_LUA', 'MASCARA_MERGULHO', 'TAPA_OLHO'
));
ALTER TABLE usuario ADD CONSTRAINT ck_usuario_estilo_outro CHECK (estilo_outro IN (
    'NENHUM', 'BRINCO', 'COLAR', 'LENCO', 'GRAVATA', 'LACO', 'BROCHE', 'MICROFONE'
));
