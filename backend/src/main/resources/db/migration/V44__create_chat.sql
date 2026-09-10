-- Pedido do usuário: "Implemente também um chat no sistema para os funcionários poderem
-- conversar e o chefe conversar com os funcionários, além de ter um grupo geral com todos os
-- funcionários" - `conversa` cobre tanto DM (DIRETA, 2 participantes) quanto o grupo fixo
-- (GERAL, 1 linha só, todo mundo entra sob demanda - ver ChatService#garantirParticipacaoNaGeral).
CREATE TABLE conversa (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('DIRETA', 'GERAL')),
    criado_em TIMESTAMPTZ NOT NULL
);

CREATE TABLE conversa_participante (
    id BIGSERIAL PRIMARY KEY,
    conversa_id BIGINT NOT NULL REFERENCES conversa (id),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    ultima_leitura_em TIMESTAMPTZ,
    CONSTRAINT uk_conversa_participante UNIQUE (conversa_id, usuario_id)
);
CREATE INDEX idx_conversa_participante_usuario ON conversa_participante (usuario_id);

CREATE TABLE mensagem (
    id BIGSERIAL PRIMARY KEY,
    conversa_id BIGINT NOT NULL REFERENCES conversa (id),
    autor_id BIGINT NOT NULL REFERENCES usuario (id),
    texto VARCHAR(2000) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_mensagem_conversa ON mensagem (conversa_id, criado_em);

-- a conversa "Geral" é única e fixa - sem linha por usuário aqui, cada um entra sozinho na
-- primeira vez que abre o chat.
INSERT INTO conversa (tipo, criado_em) VALUES ('GERAL', now());
