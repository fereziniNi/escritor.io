-- Complementa V38: exceção pontual pra uma data específica - pedido do usuário: "poder mudar
-- também o dia e hora". `trabalha=false` é uma folga nessa data mesmo que o padrão semanal diga
-- que normalmente trabalharia; `trabalha=true` exige hora_inicio/hora_fim (horário só dessa data,
-- não altera o padrão semanal).
CREATE TABLE escala_excecao (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    data DATE NOT NULL,
    trabalha BOOLEAN NOT NULL,
    hora_inicio TIME,
    hora_fim TIME,
    observacao VARCHAR(200),
    CONSTRAINT uk_escala_excecao_usuario_data UNIQUE (usuario_id, data),
    CONSTRAINT ck_escala_excecao_horario_so_se_trabalha CHECK (
        (trabalha AND hora_inicio IS NOT NULL AND hora_fim IS NOT NULL)
        OR (NOT trabalha AND hora_inicio IS NULL AND hora_fim IS NULL)
    ),
    CONSTRAINT ck_escala_excecao_fim_apos_inicio CHECK (hora_fim IS NULL OR hora_fim > hora_inicio)
);

CREATE INDEX idx_escala_excecao_usuario ON escala_excecao (usuario_id);
