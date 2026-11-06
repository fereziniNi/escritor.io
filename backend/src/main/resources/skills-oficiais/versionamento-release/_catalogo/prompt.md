Use a skill versionamento-release para dar a este sistema Multiplica um processo de versão e release.
Siga o Padrão Multiplica à risca e em TDD: copie scripts/release.test.sh primeiro, veja falhar, depois scripts/release.sh.
Crie VERSION (SemVer), CHANGELOG.md em português (Keep a Changelog), .gitattributes e .github/workflows/release.yml.
Garanta que APP_VERSAO e APP_COMMIT do build aparecem no /api/health e no rodapé da sidebar.
Rode bash scripts/release.test.sh e pnpm lint, pnpm typecheck, pnpm test; mostre o checklist de pronto.
