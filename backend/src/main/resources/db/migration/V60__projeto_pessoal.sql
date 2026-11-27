-- Projeto pessoal: projeto oculto, um por usuário, que guarda as tarefas pessoais.
ALTER TABLE projeto ADD COLUMN pessoal_de_usuario_id BIGINT REFERENCES usuario (id);

CREATE UNIQUE INDEX uk_projeto_pessoal_usuario ON projeto (pessoal_de_usuario_id) WHERE pessoal_de_usuario_id IS NOT NULL;
