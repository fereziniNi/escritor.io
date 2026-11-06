# origem: skills-modelo/deploy/restore.sh
# Restauração (skill instalacao-docker-compose). Na pasta deploy/ do servidor, com o banco no ar (docker compose up -d banco):
#   sh restore.sh --confirmar backups/banco-AAAAMMDD-HHMMSS.dump [backups/arquivos-AAAAMMDD-HHMMSS.tar.gz]
# APAGA o banco atual e põe o do backup no lugar (para app e worker antes; sobe tudo de novo no fim, e a migracao reaplica as
# migrações da versão em uso e a senha do app_runtime). Sem --confirmar não faz nada.
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
  echo "isto APAGA o banco atual do sistema e põe o backup no lugar. Rode de novo com --confirmar." >&2
  exit 1
fi

echo "parando app e worker"
docker compose stop app worker caddy
garantir_papel
echo "recriando o banco app"
psql_adm -c "DROP DATABASE IF EXISTS app WITH (FORCE)" -c "CREATE DATABASE app OWNER app"
echo "restaurando $dump"
restaurar_em app
if [ -n "$tar_arquivos" ]; then
  echo "restaurando uploads de $tar_arquivos"
  docker compose run --rm --no-deps -T app sh -c 'find /dados/arquivos -mindepth 1 -delete && tar xzf - -C /dados/arquivos' < "$tar_arquivos"
fi
echo "subindo (migracao -> app -> worker -> caddy)"
docker compose up -d
echo "pronto: confira com  curl -k https://SEU_DOMINIO/api/health"
