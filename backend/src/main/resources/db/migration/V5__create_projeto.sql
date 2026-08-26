CREATE TABLE projeto (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    inicio DATE NOT NULL,
    fim_previsto DATE,
    CONSTRAINT ck_projeto_status CHECK (status IN ('ATIVO', 'PAUSADO', 'CONCLUIDO'))
);
