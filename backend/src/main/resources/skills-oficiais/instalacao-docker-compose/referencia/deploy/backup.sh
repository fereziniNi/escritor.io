# origem: skills-modelo/deploy/backup.sh
# Backup do sistema (skill instalacao-docker-compose). Na pasta deploy/ do servidor:  sh backup.sh
# Gera, em BACKUP_PASTA (padrão ./backups), dois arquivos com data e hora, só o dono lê (chmod 600):
#   banco-AAAAMMDD-HHMMSS.dump        pg_dump -Fc do banco inteiro (dados, trilha de auditoria, fila)
#   arquivos-AAAAMMDD-HHMMSS.tar.gz   volume dos uploads (ARMAZENAMENTO_TIPO=local)
# e apaga os com mais de BACKUP_DIAS dias (padrão 14). Pode rodar com o sistema no ar.
# Agende no cron do servidor (todo dia às 2h), como root:
#   0 2 * * * cd /opt/sistema/deploy && mkdir -p backups && sh backup.sh >> backups/backup.log 2>&1
# Copie a pasta de backups para FORA do servidor (outro disco, nuvem do cliente): backup só no mesmo disco não é backup.
# O backup NÃO leva as chaves (segredos/): sem segredos/dados_chaves os CPFs restaurados não abrem. Guarde-as no cofre.
set -eu
cd "$(dirname "$0")"

# Valor do .env (sem executá-lo: valores com espaço ou < > quebrariam o shell). Variável de ambiente tem precedência.
do_env() { [ -f .env ] && grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true; }
PASTA="${BACKUP_PASTA:-$(do_env BACKUP_PASTA)}"; PASTA="${PASTA:-./backups}"
DIAS="${BACKUP_DIAS:-$(do_env BACKUP_DIAS)}"; DIAS="${DIAS:-14}"
case "$DIAS" in '' | *[!0-9]*) echo "BACKUP_DIAS deve ser um número de dias" >&2; exit 1 ;; esac

umask 077
mkdir -p "$PASTA"
chmod 700 "$PASTA"
carimbo="$(date +%Y%m%d-%H%M%S)"
banco="$PASTA/banco-$carimbo.dump"
arquivos="$PASTA/arquivos-$carimbo.tar.gz"
# Falhou no meio: nada de arquivo pela metade com cara de backup.
trap 'rm -f "$banco.parcial" "$arquivos.parcial"' EXIT

echo "$(date -Iseconds) backup do banco -> $banco"
docker compose exec -T banco pg_dump -U app -d app -Fc > "$banco.parcial"
# Confere que o arquivo é um dump legível antes de considerá-lo pronto.
docker compose exec -T banco pg_restore -l < "$banco.parcial" > /dev/null
mv "$banco.parcial" "$banco"
chmod 600 "$banco"

echo "$(date -Iseconds) backup dos uploads -> $arquivos"
docker compose run --rm --no-deps -T app sh -c 'cd /dados/arquivos && tar czf - .' > "$arquivos.parcial"
mv "$arquivos.parcial" "$arquivos"
chmod 600 "$arquivos"

# Retenção: só os arquivos deste script (banco-*.dump, arquivos-*.tar.gz), nunca outra coisa da pasta.
find "$PASTA" -maxdepth 1 -type f \( -name 'banco-*.dump' -o -name 'arquivos-*.tar.gz' \) -mtime +"$DIAS" -print -delete
echo "$(date -Iseconds) backup pronto ($(du -h "$banco" | cut -f1) banco, $(du -h "$arquivos" | cut -f1) uploads)"
