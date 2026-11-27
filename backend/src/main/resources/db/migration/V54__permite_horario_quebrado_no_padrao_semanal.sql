-- Padrão semanal com horário quebrado: o mesmo dia da semana pode ter mais de um intervalo (ex.:
-- 09:00-12:00 e 14:00-18:00). Antes a escala tinha uma única linha por (usuário, dia); agora a
-- unicidade é por (usuário, dia, hora de início).
--
-- Reconstruída a partir do schema de produção: a V54 original foi aplicada em 21/09/2026 por um
-- código que não chegou a este repositório (ver ignore-migration-patterns em application.yml).
ALTER TABLE escala_semanal DROP CONSTRAINT uk_escala_semanal_usuario_dia;
ALTER TABLE escala_semanal
    ADD CONSTRAINT uk_escala_semanal_usuario_dia_inicio UNIQUE (usuario_id, dia_semana, hora_inicio);
