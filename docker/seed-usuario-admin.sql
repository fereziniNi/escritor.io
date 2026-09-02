-- Seed só pra ambiente de teste local via docker-compose (ver serviço "seed" no docker-compose.yml)
-- - nunca roda em produção, não faz parte de nenhuma migração Flyway. Idempotente: seguro rodar
-- de novo (ON CONFLICT DO NOTHING), então reiniciar o docker-compose sem apagar o volume não
-- duplica nada.
--
-- Pedido do cliente: sem Equipe/Quadro - visibilidade agora é atribuição individual por Projeto
-- (ver migrações V26/V27), então este seed não cria mais equipe/membro_equipe/quadro/membro_quadro
-- (tabelas removidas).
INSERT INTO usuario (nome, email, papel, carga_diaria_minutos)
VALUES ('Admin Geral', 'admin@escritor.io', 'ADMIN', 480)
ON CONFLICT (email) DO NOTHING;
