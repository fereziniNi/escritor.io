CREATE TABLE projeto_equipe (
    id BIGSERIAL PRIMARY KEY,
    projeto_id BIGINT NOT NULL REFERENCES projeto (id),
    equipe_id BIGINT NOT NULL REFERENCES equipe (id),
    CONSTRAINT uk_projeto_equipe_projeto_equipe UNIQUE (projeto_id, equipe_id)
);
