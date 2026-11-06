Use a skill lgpd-dados-pessoais para proteger os dados pessoais deste sistema Multiplica.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Cifre o CPF (e outros dados sensíveis) com AES-256-GCM usando DADOS_CHAVES e crie o índice cego com DADOS_CHAVE_INDICE para buscar sem guardar em claro; sem as chaves a API não pode subir em produção.
Ligue a máscara de CPF e e-mail para quem não é GESTOR nem ADMIN e a redação de dado pessoal nos logs.
Crie o comando de retenção (RETENCAO_DIAS) e as rotas de exportar e anonimizar dados do titular, só para ADMIN e registradas na auditoria.
Preencha o docs/lgpd.md a partir do modelo da skill, marcando como "a definir" o que depende do jurídico.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
