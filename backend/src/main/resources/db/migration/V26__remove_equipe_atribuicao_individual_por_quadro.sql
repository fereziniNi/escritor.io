-- Pedido do cliente (via usuário): "sem equipes... vai atribuir pessoas individuais aos devidos
-- sistemas [quadros] e atividades [cards] do sistema" - Equipe some por completo, substituída por
-- atribuição individual pessoa -> quadro (membro_quadro), que passa a ser também a regra de
-- visibilidade (quem vê o quê).

-- quadro não precisa mais de projeto OU equipe - um nome já basta (visibilidade agora é por
-- atribuição individual, não por vínculo de projeto/equipe).
ALTER TABLE quadro DROP CONSTRAINT ck_quadro_projeto_ou_equipe;
ALTER TABLE quadro DROP COLUMN equipe_id;

-- ordem importa: projeto_equipe e membro_equipe referenciam equipe, precisam sumir antes dela.
DROP TABLE projeto_equipe;
DROP TABLE membro_equipe;
DROP TABLE equipe;

CREATE TABLE membro_quadro (
    id BIGSERIAL PRIMARY KEY,
    quadro_id BIGINT NOT NULL REFERENCES quadro (id),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_membro_quadro_quadro_usuario UNIQUE (quadro_id, usuario_id)
);

CREATE INDEX idx_membro_quadro_usuario ON membro_quadro (usuario_id);
CREATE INDEX idx_membro_quadro_quadro ON membro_quadro (quadro_id);
