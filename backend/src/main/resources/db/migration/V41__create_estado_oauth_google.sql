-- Nonce opaco de uso único pra resolver com segurança "qual usuário está voltando do redirect da
-- Google" sem precisar colocar o token de acesso (mesmo sendo de 15min) numa URL de navegação de
-- página inteira. Curta duração (`expira_em`) e apagado assim que usado - ver
-- `GoogleOAuthService#iniciarConexao`/`tratarCallback`.
CREATE TABLE estado_oauth_google (
    nonce VARCHAR(64) PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id),
    expira_em TIMESTAMPTZ NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_estado_oauth_google_usuario ON estado_oauth_google (usuario_id);
