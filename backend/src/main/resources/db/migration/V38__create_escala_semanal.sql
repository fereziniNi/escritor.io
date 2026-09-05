-- Pedido do usuário: "calendário individual para indicar os dias que ira trabalhar com opção de
-- deixar sempre a configuração" - padrão semanal recorrente, uma linha por dia da semana em que o
-- usuário normalmente trabalha. Ausência de linha pra um dia = não trabalha nesse dia (mais
-- simples que uma flag `ativo` - a própria ausência já é a resposta).
CREATE TABLE escala_semanal (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    dia_semana VARCHAR(9) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    CONSTRAINT uk_escala_semanal_usuario_dia UNIQUE (usuario_id, dia_semana),
    CONSTRAINT ck_escala_semanal_dia_semana CHECK (dia_semana IN
        ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    CONSTRAINT ck_escala_semanal_fim_apos_inicio CHECK (hora_fim > hora_inicio)
);

CREATE INDEX idx_escala_semanal_usuario ON escala_semanal (usuario_id);
