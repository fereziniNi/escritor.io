# origem: skills-modelo/deploy/testar-backup.sh
# Prova que o backup restaura (skill instalacao-docker-compose). Na pasta deploy/, com o sistema no ar:  sh testar-backup.sh
# Faz um backup (backup.sh), restaura o dump num banco NOVO ao lado (restore.sh com BANCO_DESTINO), compara a contagem de
# linhas de cada tabela dos schemas public e drizzle com o banco do sistema e apaga o banco de teste. Não toca no sistema.
# Rode uma vez por mês (e depois de cada atualização grande): backup que nunca foi restaurado não é backup.
# Fora do horário de uso: alguém usando o sistema entre o backup e a contagem muda os números (rode de novo).
set -eu
cd "$(dirname "$0")"

teste=teste_restauracao
contar() {
  docker compose exec -T banco psql -U app -d "$1" -At -c "
    SELECT table_schema || '.' || table_name || '=' ||
      (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'drizzle') AND table_type = 'BASE TABLE'
    ORDER BY 1"
}
apagar_teste() { docker compose exec -T banco psql -U app -d postgres -q -c "DROP DATABASE IF EXISTS $teste WITH (FORCE)" > /dev/null; }

apagar_teste
sh backup.sh
do_env() { [ -f .env ] && grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true; }
pasta="${BACKUP_PASTA:-$(do_env BACKUP_PASTA)}"; pasta="${pasta:-./backups}"
dump="$(ls -t "$pasta"/banco-*.dump | head -n 1)"
BANCO_DESTINO=$teste sh restore.sh "$dump"

original="$(contar app)"
restaurado="$(contar $teste)"
fila="$(docker compose exec -T banco psql -U app -d $teste -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'fila'")"
apagar_teste

echo "tabelas (linhas) no backup restaurado:"
echo "$restaurado" | sed 's/^/  /'
if [ -z "$restaurado" ] || [ "$original" != "$restaurado" ]; then
  echo "FALHOU: o banco restaurado difere do banco do sistema" >&2
  echo "sistema:" >&2; echo "$original" | sed 's/^/  /' >&2
  exit 1
fi
if [ "$fila" -eq 0 ]; then echo "FALHOU: o schema fila não veio no backup" >&2; exit 1; fi
echo "OK: backup $dump restaurado num banco vazio com as mesmas linhas ($fila tabelas da fila também)"
