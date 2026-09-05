-- Usuário: "O personagem pode ser masculino ou feminino também!" - até aqui o corpo era sempre a
-- mesma silhueta masculina (decisão da curadoria original: "1 gênero de base pro avatar"),
-- independente da cabeça (tipo_rosto) ou de qualquer outra coisa escolhida. Sem paleta de cor
-- própria - usa cor_pele, mesmo padrão de tipo_rosto/tipo_barba.
ALTER TABLE usuario ADD COLUMN tipo_corpo VARCHAR(20) NOT NULL DEFAULT 'MASCULINO';

ALTER TABLE usuario ADD CONSTRAINT ck_usuario_tipo_corpo CHECK (tipo_corpo IN (
    'MASCULINO', 'FEMININO'
));
