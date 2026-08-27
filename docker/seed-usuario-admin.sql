-- Seed só pra ambiente de teste local via docker-compose (ver serviço "seed" no docker-compose.yml)
-- - nunca roda em produção, não faz parte de nenhuma migração Flyway. Idempotente: seguro rodar
-- de novo (ON CONFLICT DO NOTHING), então reiniciar o docker-compose sem apagar o volume não
-- duplica nada.
INSERT INTO usuario (nome, email, papel, carga_diaria_minutos)
VALUES ('Admin Geral', 'admin@escritor.io', 'ADMIN', 480)
ON CONFLICT (email) DO NOTHING;

INSERT INTO equipe (nome, descricao, ativa)
SELECT 'Equipe Geral', 'Criada pelo seed de teste local', true
WHERE NOT EXISTS (SELECT 1 FROM equipe WHERE nome = 'Equipe Geral');

INSERT INTO membro_equipe (equipe_id, usuario_id, papel_na_equipe)
SELECT e.id, u.id, 'LIDER'
FROM equipe e, usuario u
WHERE e.nome = 'Equipe Geral' AND u.email = 'admin@escritor.io'
  AND NOT EXISTS (
    SELECT 1 FROM membro_equipe me WHERE me.equipe_id = e.id AND me.usuario_id = u.id
  );
