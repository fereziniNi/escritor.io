-- Pedido do usuário: "Não achei a parte da notificação dentro do sistema... quero ver as últimas
-- que chegaram no sistema" - até aqui os avisos (convite de reunião, tarefa concluída, nova
-- tarefa, sorteio do Happy Hour) eram só um toast que some em 4s + som/pisca de aba, sem nenhum
-- rastro (ver comentário em PresencaWebSocketHandler.avisarNovaTarefa: "sem inbox persistente de
-- notificação neste app" - decisão revertida agora). `link` nasce nulo pra maioria (só o convite
-- de reunião carrega o link do Meet).
CREATE TABLE notificacao (
    id BIGSERIAL PRIMARY KEY,
    destinatario_id BIGINT NOT NULL REFERENCES usuario(id),
    tipo VARCHAR(40) NOT NULL,
    texto TEXT NOT NULL,
    link VARCHAR(500),
    lida BOOLEAN NOT NULL DEFAULT false,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- toda consulta é "últimas N de um destinatário" - índice composto na ordem certa de busca.
CREATE INDEX idx_notificacao_destinatario ON notificacao (destinatario_id, criado_em DESC);
