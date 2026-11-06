-- Pedido do usuário: um catálogo de skills da Multiplica dentro do app - qualquer pessoa cria e
-- edita skills (pastas de arquivos que o Claude Code carrega), copia o prompt de uso e baixa o
-- .zip; as marcadas como "oficiais" só mudam com aprovação de GESTOR/ADMIN. Cada salvamento gera
-- uma `skill_versao` imutável (nome, descrição e categoria também são versionados); a skill
-- aponta para a versão vigente. `autor_id` nulo = "Sistema" (importador das skills oficiais).
CREATE TABLE skill (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    oficial BOOLEAN NOT NULL DEFAULT false,
    arquivada BOOLEAN NOT NULL DEFAULT false,
    versao_vigente_id BIGINT,
    criada_por_id BIGINT NOT NULL REFERENCES usuario(id),
    criada_em TIMESTAMPTZ NOT NULL,
    hash_importado VARCHAR(100)
);

CREATE TABLE skill_versao (
    id BIGSERIAL PRIMARY KEY,
    skill_id BIGINT NOT NULL REFERENCES skill(id),
    numero INT NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PUBLICADA', 'PROPOSTA', 'REJEITADA')),
    nome VARCHAR(120) NOT NULL,
    descricao TEXT NOT NULL,
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN
        ('FUNDACAO', 'SEGURANCA', 'INTERFACE', 'IA', 'INFRA', 'DADOS', 'OUTRAS')),
    prompt_uso TEXT NOT NULL,
    tutorial_instalacao TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    autor_id BIGINT REFERENCES usuario(id),
    criada_em TIMESTAMPTZ NOT NULL,
    decidida_por_id BIGINT REFERENCES usuario(id),
    decidida_em TIMESTAMPTZ,
    motivo_rejeicao TEXT,
    CONSTRAINT uk_skill_versao_numero UNIQUE (skill_id, numero)
);

ALTER TABLE skill
    ADD CONSTRAINT fk_skill_versao_vigente FOREIGN KEY (versao_vigente_id) REFERENCES skill_versao(id);

CREATE INDEX idx_skill_versao_estado_criada_em ON skill_versao (estado, criada_em);

CREATE TABLE skill_arquivo (
    id BIGSERIAL PRIMARY KEY,
    versao_id BIGINT NOT NULL REFERENCES skill_versao(id),
    -- COLLATE "C": ordem por bytes (SKILL.md antes de referencia/...), igual em qualquer banco/locale
    caminho VARCHAR(200) COLLATE "C" NOT NULL,
    conteudo TEXT NOT NULL,
    CONSTRAINT uk_skill_arquivo_caminho UNIQUE (versao_id, caminho)
);

CREATE TABLE skill_evento (
    id BIGSERIAL PRIMARY KEY,
    skill_id BIGINT NOT NULL REFERENCES skill(id),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('OFICIALIZADA', 'OFICIAL_REMOVIDO', 'ARQUIVADA', 'DESARQUIVADA')),
    usuario_id BIGINT REFERENCES usuario(id),
    ocorrido_em TIMESTAMPTZ NOT NULL,
    detalhe TEXT
);

CREATE INDEX idx_skill_evento_skill ON skill_evento (skill_id, ocorrido_em);
