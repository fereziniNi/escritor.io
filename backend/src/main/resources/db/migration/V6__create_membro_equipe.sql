CREATE TABLE membro_equipe (
    id BIGSERIAL PRIMARY KEY,
    equipe_id BIGINT NOT NULL REFERENCES equipe (id),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    papel_na_equipe VARCHAR(20) NOT NULL,
    CONSTRAINT uk_membro_equipe_equipe_usuario UNIQUE (equipe_id, usuario_id),
    CONSTRAINT ck_membro_equipe_papel CHECK (papel_na_equipe IN ('MEMBRO', 'LIDER'))
);
