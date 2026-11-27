Use a skill seguranca para aplicar a linha de base de segurança Multiplica neste sistema.
Siga o Padrão Multiplica à risca e em TDD: copie os testes primeiro, veja falhar, depois o código.
Ligue cabeçalhos, CORS por lista (CORS_ORIGENS), checagem de origem contra CSRF e limite por IP (LIMITE_REQ_POR_IP).
Deixe PROXIES_CONFIAVEIS=1 no deploy/.env.example, copie o snippet do Caddy com a CSP e a CI com gitleaks, pnpm audit, CodeQL e Dependabot.
Marque com @MesmaOrigem() todo GET que altera algo e garanta que nenhuma mensagem revela se e-mail ou CPF existe.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build, preencha o checklist de pentest e mostre o checklist de pronto.
