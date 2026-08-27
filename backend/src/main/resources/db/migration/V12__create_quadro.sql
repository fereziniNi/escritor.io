CREATE TABLE quadro (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    projeto_id BIGINT REFERENCES projeto (id),
    equipe_id BIGINT REFERENCES equipe (id),
    arquivado BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- PRD §3.3: os dois nulos ao mesmo tempo é combinação inválida. A validação também vive no
    -- construtor de Quadro (Java), mas a constraint é quem garante isso mesmo se algum caminho
    -- futuro bypassar a entidade.
    CONSTRAINT ck_quadro_projeto_ou_equipe CHECK (projeto_id IS NOT NULL OR equipe_id IS NOT NULL)
);

CREATE INDEX idx_quadro_projeto ON quadro (projeto_id);
CREATE INDEX idx_quadro_equipe ON quadro (equipe_id);
