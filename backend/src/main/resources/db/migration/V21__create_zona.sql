CREATE TABLE zona (
    id BIGSERIAL PRIMARY KEY,
    mapa_id BIGINT NOT NULL REFERENCES mapa (id),
    nome VARCHAR(255) NOT NULL,
    x INT NOT NULL,
    y INT NOT NULL,
    largura INT NOT NULL,
    altura INT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    CONSTRAINT ck_zona_tipo CHECK (tipo IN ('FOCO', 'REUNIAO', 'CAFE', 'ATENDIMENTO', 'LIVRE'))
);

CREATE INDEX idx_zona_mapa ON zona (mapa_id);

-- Zonas do mapa v1 (mesmo espírito de V20: definidas à mão, versionadas na migração).
INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Sala de foco', 0, 0, 4, 4, 'FOCO' FROM mapa WHERE ativo = true;

INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Sala de reunião', 5, 0, 5, 5, 'REUNIAO' FROM mapa WHERE ativo = true;

INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Café', 11, 0, 4, 4, 'CAFE' FROM mapa WHERE ativo = true;
