-- Pedido do usuário: mudar a carga diária (ex.: 6h -> 8h a partir de 30/11) sem reescrever os meses
-- anteriores. Antes havia um único valor em usuario.carga_diaria_minutos, e o saldo de QUALQUER
-- mês era recalculado com o valor atual. Agora cada mudança vale a partir de uma data
-- (vigente_desde) e o saldo de cada dia usa a carga que valia naquele dia.
CREATE TABLE carga_diaria_historico (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    vigente_desde DATE NOT NULL,
    minutos INTEGER NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_carga_diaria_usuario_data UNIQUE (usuario_id, vigente_desde),
    CONSTRAINT ck_carga_diaria_minutos_positivos CHECK (minutos > 0)
);

-- Estado atual vira o ponto de partida: vale desde sempre, então nenhum dia passado muda de saldo
-- por causa desta migração.
INSERT INTO carga_diaria_historico (usuario_id, vigente_desde, minutos)
SELECT id, DATE '1970-01-01', carga_diaria_minutos FROM usuario;
