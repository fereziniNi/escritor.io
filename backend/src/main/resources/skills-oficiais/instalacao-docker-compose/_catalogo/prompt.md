Use a skill instalacao-docker-compose para preparar a instalação deste sistema Multiplica no servidor do cliente.
Siga o Padrão Multiplica à risca e em TDD: copie o teste senha-runtime primeiro, veja falhar, depois o código.
Crie o Dockerfile (imagem única, não-root, NODE_ENV=production, HEALTHCHECK) e o deploy/ com docker-compose.yml, Caddyfile, .env.example, gerar-segredos.sh, backup.sh, restore.sh, testar-backup.sh e INSTALACAO.md.
Só o Caddy publica porta; a migração usa o dono do banco e a aplicação o papel app_runtime; segredos ficam em arquivo; a imagem sobe por tag de versão, nunca latest.
Prove de ponta a ponta com tls internal: health pelo Caddy, login com código pelo Mailpit, testar-backup.sh com OK e restauração.
No fim, rode pnpm lint, pnpm typecheck, pnpm test e pnpm build e mostre o checklist de pronto.
