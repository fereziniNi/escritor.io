ALTER TABLE zona DROP CONSTRAINT ck_zona_tipo;
ALTER TABLE zona ADD CONSTRAINT ck_zona_tipo
    CHECK (tipo IN ('FOCO', 'REUNIAO', 'CAFE', 'ATENDIMENTO', 'LIVRE', 'HAPPY_HOUR'));

-- Área livre no canto superior direito do mapa 28x20 (Reunião ocupa x1-8/y1-7, Café x13-19/y1-7) -
-- mesmo tamanho de sala das outras, sem sobrepor nada.
INSERT INTO zona (mapa_id, nome, x, y, largura, altura, tipo)
SELECT id, 'Happy Hour', 20, 1, 7, 6, 'HAPPY_HOUR' FROM mapa WHERE ativo = true;

CREATE TABLE atividade_happy_hour (
    id BIGSERIAL PRIMARY KEY,
    descricao TEXT NOT NULL,
    sugerida_por BIGINT NOT NULL REFERENCES usuario (id),
    criada_em TIMESTAMPTZ NOT NULL,
    sorteada_em TIMESTAMPTZ
);
CREATE INDEX idx_atividade_happy_hour_sorteada ON atividade_happy_hour (sorteada_em);
