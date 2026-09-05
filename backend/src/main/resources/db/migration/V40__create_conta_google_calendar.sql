-- Pedido do usuário: "algo muito parecido com o agenda do google. Poderia fazer isso?? Ou ate
-- mesmo integrar?" - cada funcionário conecta a própria conta Google (OAuth2) uma vez; a escala
-- dele é publicada como eventos no Google Agenda dele mesmo (via mão única, não lemos o Google
-- Agenda de volta). `refresh_token` vem criptografado (AES/GCM em `ContaGoogleCalendar`) -
-- diferente de `token_renovacao.token_hash` (SHA-256, só comparação), aqui o valor precisa voltar
-- em texto claro pra ser reenviado pra Google, então hash não serve.
CREATE TABLE conta_google_calendar (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    refresh_token TEXT NOT NULL,
    calendario_id VARCHAR(255) NOT NULL DEFAULT 'primary',
    conectado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultima_sincronizacao_em TIMESTAMPTZ,
    CONSTRAINT uk_conta_google_calendar_usuario UNIQUE (usuario_id)
);
