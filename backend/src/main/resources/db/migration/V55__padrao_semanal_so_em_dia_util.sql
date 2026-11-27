-- Padrão semanal só em dia útil (segunda a sexta). Fim de semana é tratado por exceção pontual
-- (escala_excecao), não pelo padrão que se repete toda semana.
--
-- Reconstruída a partir do schema de produção (aplicada em 21/09/2026, arquivo original perdido).
DELETE FROM escala_semanal WHERE dia_semana IN ('SATURDAY', 'SUNDAY');

ALTER TABLE escala_semanal DROP CONSTRAINT ck_escala_semanal_dia_semana;
ALTER TABLE escala_semanal
    ADD CONSTRAINT ck_escala_semanal_dia_semana
    CHECK (dia_semana IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'));
