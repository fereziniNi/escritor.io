-- Uma única proposta pendente por skill, garantida pelo banco (fecha a corrida de dois salvamentos
-- simultâneos em skill oficial: o segundo recebe violação de unicidade em vez de duplicar).
CREATE UNIQUE INDEX uq_skill_versao_proposta_pendente ON skill_versao (skill_id) WHERE estado = 'PROPOSTA';

-- Skills importadas do repositório são criadas pelo "Sistema" (sem usuário técnico): criador nulo.
ALTER TABLE skill ALTER COLUMN criada_por_id DROP NOT NULL;
