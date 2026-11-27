# origem: skills-modelo/deploy/gerar-segredos.sh
# Cria deploy/segredos/ com senhas e chaves aleatórias (skill instalacao-docker-compose). Rode UMA vez, na pasta deploy/:
#   Linux:      sh gerar-segredos.sh
#   PowerShell: docker run --rm -v "${PWD}:/deploy" busybox:1.37.0 sh /deploy/gerar-segredos.sh
# Nunca sobrescreve: arquivo que já existe com conteúdo é mantido (rodar de novo só completa o que falta).
# Guarde uma cópia de segredos/ no cofre do cliente: perder dados_chaves = perder os CPFs cifrados.
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p segredos
chmod 700 segredos

aleatorio_hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
aleatorio_b64() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }
# Valor de uma instalação antiga que guardava a senha do Langfuse no .env (a senha do banco do Langfuse não pode mudar
# depois de criado o volume). Sem .env ou sem a linha: vazio.
do_env() { [ -f .env ] && grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true; }
antigo_ou_novo() { v="$(do_env "$1")"; if [ -n "$v" ]; then printf '%s' "$v"; else aleatorio_hex "$2"; fi; }

gravar() {
  if [ -s "segredos/$1" ]; then
    echo "mantido: segredos/$1"
  else
    printf '%s' "$2" > "segredos/$1"
    echo "criado:  segredos/$1"
  fi
}

# Senhas em hexadecimal: entram em URL postgres:// sem precisar de escape.
gravar banco_senha "$(aleatorio_hex 24)"
gravar database_url "postgres://app:$(cat segredos/banco_senha)@banco:5432/app"
gravar database_url_runtime "postgres://app_runtime:$(aleatorio_hex 24)@banco:5432/app"
gravar auth_segredo_codigo "$(aleatorio_hex 32)"
gravar dados_chaves "k1:$(aleatorio_b64)"
gravar dados_chave_indice "$(aleatorio_b64)"
gravar segredo_url "$(aleatorio_hex 32)"

# Segredos que vêm de fora e a TI escreve (vazio = não usado): senha do SMTP, chave da IA, chave secreta do Langfuse (do
# projeto, criada no painel), chave do S3 e connection string do Azure. Ficam só-leitura no fim; para preencher um:
#   chmod 600 segredos/NOME && printf '%s' 'VALOR' > segredos/NOME && chmod 444 segredos/NOME && docker compose up -d
for nome in smtp_senha anthropic_api_key langfuse_secret_key s3_secret_key azure_connection_string; do
  [ -e "segredos/$nome" ] || { : > "segredos/$nome"; echo "criado:  segredos/$nome (vazio: preencha se for usar)"; }
done

# Infraestrutura do Langfuse (profile langfuse): lido SÓ pelos serviços langfuse-* (env_file), nunca por app, worker e migracao.
# Já nos nomes que cada contêiner espera. Instalação antiga com LANGFUSE_*_PASSWORD no .env: os valores de lá são reaproveitados
# (depois apague essas linhas do .env).
if [ -s segredos/langfuse.env ]; then
  echo "mantido: segredos/langfuse.env"
else
  db="$(antigo_ou_novo LANGFUSE_DB_PASSWORD 24)"
  ch="$(antigo_ou_novo LANGFUSE_CLICKHOUSE_PASSWORD 24)"
  rd="$(antigo_ou_novo LANGFUSE_REDIS_PASSWORD 24)"
  mn="$(antigo_ou_novo LANGFUSE_MINIO_PASSWORD 24)"
  cat > segredos/langfuse.env <<FIM
# Gerado por gerar-segredos.sh. Só os serviços langfuse-* leem este arquivo.
DATABASE_URL=postgresql://langfuse:$db@langfuse-db:5432/langfuse
POSTGRES_PASSWORD=$db
SALT=$(antigo_ou_novo LANGFUSE_SALT 32)
ENCRYPTION_KEY=$(antigo_ou_novo LANGFUSE_ENCRYPTION_KEY 32)
NEXTAUTH_SECRET=$(antigo_ou_novo LANGFUSE_NEXTAUTH_SECRET 32)
CLICKHOUSE_PASSWORD=$ch
REDIS_AUTH=$rd
REDIS_PW=$rd
MINIO_ROOT_PASSWORD=$mn
LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY=$mn
LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY=$mn
# Senha do primeiro acesso ao painel (usuário LANGFUSE_INIT_USER_EMAIL do .env). Troque no painel depois de entrar.
LANGFUSE_INIT_USER_PASSWORD=$(antigo_ou_novo LANGFUSE_INIT_USER_PASSWORD 16)
FIM
  echo "criado:  segredos/langfuse.env"
fi

# A pasta (700) protege os arquivos no servidor; os arquivos ficam legíveis para os processos sem privilégio dos
# contêineres (usuário node da imagem, postgres), que os recebem montados em /run/secrets.
chmod 444 segredos/*
echo "pronto. Faça uma cópia de segredos/ no cofre de senhas do cliente."
