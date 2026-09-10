-- Pedido do usuário: "o chefe terá a possibilidade de marcar reuniões apenas dentro do horário
-- onde o funcionário ira trabalhar" - reunião é uma entidade própria (não uma escala_excecao), com
-- quem criou (chefe) e quem participa (funcionário). "Dentro do expediente efetivo do funcionário"
-- depende de escala_semanal + escala_excecao (EscalaService#calcularEfetiva), então não dá pra
-- expressar como CHECK de banco - essa regra fica em código, no ReuniaoService, no momento da
-- criação.
CREATE TABLE reuniao (
    id BIGSERIAL PRIMARY KEY,
    criador_id BIGINT NOT NULL REFERENCES usuario (id),
    funcionario_id BIGINT NOT NULL REFERENCES usuario (id),
    data DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_reuniao_fim_apos_inicio CHECK (hora_fim > hora_inicio)
);

CREATE INDEX idx_reuniao_funcionario_data ON reuniao (funcionario_id, data);
CREATE INDEX idx_reuniao_criador ON reuniao (criador_id);
