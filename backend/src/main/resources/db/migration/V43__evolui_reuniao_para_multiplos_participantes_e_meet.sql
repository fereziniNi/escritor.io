-- Pedido do usuário: integração real com Google Meet - qualquer usuário marca reunião com quem
-- quiser da equipe (não só chefe->funcionário) e ganha um link de Meet de verdade pra entrar e
-- compartilhar. `funcionario_id` (um convidado só) não serve mais - vira uma tabela própria de
-- participantes (`reuniao_participante`), espelhando como a própria API de eventos da Google
-- modela `attendees` (uma lista). `link_meet` só é preenchido depois que a Google responde à
-- criação do evento (ela que gera o link, não nós - `conferenceData.createRequest`).
ALTER TABLE reuniao ADD COLUMN link_meet VARCHAR(500);
ALTER TABLE reuniao DROP COLUMN funcionario_id;

CREATE TABLE reuniao_participante (
    id BIGSERIAL PRIMARY KEY,
    reuniao_id BIGINT NOT NULL REFERENCES reuniao (id),
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    CONSTRAINT uk_reuniao_participante UNIQUE (reuniao_id, usuario_id)
);

CREATE INDEX idx_reuniao_participante_usuario ON reuniao_participante (usuario_id);
