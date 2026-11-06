Use a skill ia-langfuse para ligar este sistema Multiplica a um modelo de IA com custo e privacidade sob controle.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Toda chamada passa pelo ClienteIa (SDK @anthropic-ai/sdk 1.6.0), com IA_HABILITADA=false por padrão, modelo por tarefa (modeloPara, LLM_MODELO_<TAREFA>) e ANTHROPIC_API_KEY como segredo obrigatório em produção.
Rastreie no Langfuse só com metadados (LANGFUSE_CAPTURAR_CONTEUDO=false) e, se o conteúdo for ligado, mascare CPF, CNPJ, e-mail e chaves.
Mostre uma rota real (POST /api/ia/resumir) com papel, limite por usuário e auditoria sem o texto, e prepare o Langfuse self-host (profile langfuse).
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
