# Restauração (skill instalacao-docker-compose). Na pasta deploy/ do servidor, com o banco no ar (docker compose up -d banco):
#   sh restore.sh --confirmar backups/banco-AAAAMMDD-HHMMSS.dump [backups/arquivos-AAAAMMDD-HHMMSS.tar.gz]
# Troca o banco do sistema pelo do backup SEM apagar o atual antes da hora: restaura num banco novo (app_restaurando) com o
# sistema ainda no ar, confere, só então para app/worker/caddy e troca os nomes (app -> app_antes_AAAAMMDD-HHMMSS,
# app_restaurando -> app). Os uploads idem: extraídos numa pasta ao lado, os atuais salvos em backups/ antes da troca. No fim
# sobe tudo (a migracao reaplica as migrações da versão em uso e a senha do app_runtime). Falhou antes da troca: nada mudou.
# Sem --confirmar não faz nada. O banco anterior fica guardado: confira o sistema e apague-o depois (o comando aparece no fim).
# Restaurar num banco NOVO ao lado (conferir um backup sem tocar no sistema): BANCO_DESTINO=conferencia sh restore.sh arquivo.dump
# (o banco "conferencia" não pode existir; apague depois com: docker compose exec banco dropdb -U app conferencia).
# Os segredos (segredos/) têm de ser os mesmos do servidor de origem: sem a mesma dados_chaves os CPFs não abrem.
set -eu
cd "$(dirname "$0")"

confirmado=nao
if [ "${1:-}" = "--confirmar" ]; then confirmado=sim; shift; fi
dump="${1:-}"
tar_arquivos="${2:-}"
destino="${BANCO_DESTINO:-app}"
[ -n "$dump" ] && [ -f "$dump" ] || { echo "uso: sh restore.sh --confirmar backups/banco-....dump [backups/arquivos-....tar.gz]" >&2; exit 1; }
[ -z "$tar_arquivos" ] || [ -f "$tar_arquivos" ] || { echo "arquivo não encontrado: $tar_arquivos" >&2; exit 1; }
case "$destino" in *[!a-z0-9_]*) echo "BANCO_DESTINO: só letras minúsculas, números e _" >&2; exit 1 ;; esac

psql_adm() { docker compose exec -T banco psql -v ON_ERROR_STOP=1 -U app -d postgres -q "$@"; }

# Papel de runtime é do servidor Postgres (não vai no dump): num servidor novo ele ainda não existe e os GRANT do dump falhariam.
garantir_papel() {
  psql_adm -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN CREATE ROLE app_runtime NOLOGIN; END IF; END \$\$"
}

restaurar_em() {
  docker compose exec -T banco pg_restore -U app -d "$1" --exit-on-error < "$dump"
}

if [ "$destino" != "app" ]; then
  echo "restaurando $dump no banco novo \"$destino\" (o sistema continua no ar)"
  garantir_papel
  psql_adm -c "CREATE DATABASE $destino OWNER app"
  restaurar_em "$destino"
  echo "pronto: banco \"$destino\" restaurado"
  exit 0
fi

if [ "$confirmado" != "sim" ]; then
  echo "isto TROCA o banco do sistema pelo do backup (o atual fica guardado como app_antes_...). Rode de novo com --confirmar." >&2
  exit 1
fi

carimbo="$(date +%Y%m%d_%H%M%S)"
antigo="app_antes_$carimbo"

# 1. Restaura ao lado, com o sistema no ar. Qualquer erro aqui: apaga só o app_restaurando; o banco do sistema não foi tocado.
garantir_papel
psql_adm -c "DROP DATABASE IF EXISTS app_restaurando WITH (FORCE)" -c "CREATE DATABASE app_restaurando OWNER app"
echo "restaurando $dump em app_restaurando (o sistema continua no ar)"
if ! restaurar_em app_restaurando; then
  psql_adm -c "DROP DATABASE IF EXISTS app_restaurando WITH (FORCE)" || true
  echo "FALHOU: o backup não restaurou; o banco do sistema não foi tocado" >&2
  exit 1
fi
# 2. Confere: as migrações vieram (backup de um banco deste sistema, não vazio).
migracoes="$(docker compose exec -T banco psql -U app -d app_restaurando -At -c "SELECT count(*) FROM drizzle.__drizzle_migrations" 2>/dev/null || true)"
case "$migracoes" in '' | 0 | *[!0-9]*)
  psql_adm -c "DROP DATABASE IF EXISTS app_restaurando WITH (FORCE)" || true
  echo "FALHOU: o banco restaurado não tem as migrações do sistema; o banco do sistema não foi tocado" >&2
  exit 1 ;;
esac
echo "conferido: $migracoes migrações no banco restaurado"

# 3. Uploads: extraídos numa pasta ao lado dentro do volume (o sistema ainda no ar).
if [ -n "$tar_arquivos" ]; then
  echo "extraindo uploads de $tar_arquivos ao lado dos atuais"
  docker compose run --rm --no-deps -T app sh -c 'rm -rf /dados/arquivos/.restaurando && mkdir /dados/arquivos/.restaurando && tar xzf - -C /dados/arquivos/.restaurando' < "$tar_arquivos" || {
    docker compose run --rm --no-deps -T app rm -rf /dados/arquivos/.restaurando || true
    psql_adm -c "DROP DATABASE IF EXISTS app_restaurando WITH (FORCE)" || true
    echo "FALHOU: o arquivo de uploads não extraiu; nada foi trocado" >&2
    exit 1
  }
fi

# 4. Troca: só agora o sistema para.
echo "parando app, worker e caddy"
docker compose stop app worker caddy
echo "trocando os bancos: app -> $antigo, app_restaurando -> app"
psql_adm -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'app' AND pid <> pg_backend_pid()" > /dev/null
psql_adm -c "ALTER DATABASE app RENAME TO $antigo"
if ! psql_adm -c "ALTER DATABASE app_restaurando RENAME TO app"; then
  psql_adm -c "ALTER DATABASE $antigo RENAME TO app"
  docker compose up -d
  echo "FALHOU: a troca de nomes não completou; o banco anterior voltou a ser o do sistema" >&2
  exit 1
fi
if [ -n "$tar_arquivos" ]; then
  mkdir -p backups
  echo "guardando os uploads atuais em backups/arquivos-antes-$carimbo.tar.gz e trocando pelos do backup"
  (umask 077 && docker compose run --rm --no-deps -T app sh -c 'cd /dados/arquivos && tar czf - --exclude=./.restaurando .' > "backups/arquivos-antes-$carimbo.tar.gz")
  chmod 600 "backups/arquivos-antes-$carimbo.tar.gz"
  docker compose run --rm --no-deps -T app sh -c 'cd /dados/arquivos && find . -mindepth 1 -maxdepth 1 ! -name .restaurando -exec rm -rf {} + && find .restaurando -mindepth 1 -maxdepth 1 -exec mv {} . \; && rmdir .restaurando'
fi
echo "subindo (migracao -> app -> worker -> caddy)"
docker compose up -d
echo "pronto: confira com  curl -k https://SEU_DOMINIO/api/health"
echo "o banco anterior ficou como \"$antigo\". Conferido o sistema, apague-o:  docker compose exec banco dropdb -U app $antigo"
