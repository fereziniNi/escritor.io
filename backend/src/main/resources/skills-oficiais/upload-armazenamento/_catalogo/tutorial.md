# Tutorial — Upload e armazenamento de arquivos

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **upload-armazenamento**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/upload-armazenamento/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

Na tela aparece o campo **Arquivo** e a opção **Quem pode ver** ("Só eu" ou "Eu e os gestores"). Dá para enviar PDF, imagem (PNG ou JPEG) e
planilha Excel (.xlsx), até o tamanho máximo combinado (10 MB, se ninguém mudar). Se o arquivo for grande demais ou de outro tipo (mesmo que
tenha sido renomeado para parecer um PDF), o sistema avisa e não guarda nada. Quem não é dono nem tem o papel certo nem sabe que o arquivo existe.
Baixar sempre salva o arquivo no computador; ele nunca abre dentro do sistema. Cada envio, download e remoção fica na auditoria. Se o antivírus
estiver ligado, o arquivo só aparece depois de verificado.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual`, `seguranca`, `email-transacional`, `usuarios-e-papeis`, `login-codigo-email`, `trilha-auditoria`, `lgpd-dados-pessoais` e `exportacao-excel-pdf-csv` já aplicadas | `ls apps/api/src/exportacao` ou `dir apps\api\src\exportacao` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres, MinIO e Azurite dos testes) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `ARMAZENAMENTO_TIPO` | não (padrão `local`) | `s3` | onde os arquivos ficam: `local` (pasta do servidor), `s3` (S3, MinIO) ou `azure` |
| `ARMAZENAMENTO_PASTA` | não (padrão `dados/arquivos`) | `/dados/arquivos` | pasta do tipo `local`; em produção, um volume |
| `ARMAZENAMENTO_SEGREDO_URL` | em produção com `local` | `(openssl rand -hex 32)` | chave dos links de download; sem ela a API não sobe em produção |
| `UPLOAD_MAX_MB` | não (padrão 10) | `10` | tamanho máximo de um arquivo, de 1 a 500 |
| `UPLOAD_LIMITE_POR_MIN` | não (padrão 20) | `20` | envios por minuto por usuário |
| `URL_ASSINADA_SEGUNDOS` | não (padrão 300) | `300` | validade do link de download (10 a 3600) |
| `S3_ENDPOINT` | só em MinIO e similares | `http://localhost:9000` | endereço do S3 compatível (vazio na AWS) |
| `S3_REGION` | não (padrão `us-east-1`) | `sa-east-1` | região do bucket |
| `S3_BUCKET` | com `s3` | `meu-sistema-arquivos` | bucket privado |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | com `s3` | `(da conta de serviço)` | credencial do bucket; a secreta vai por `S3_SECRET_KEY_ARQUIVO` em produção |
| `S3_PATH_STYLE` | não (padrão `false`) | `true` | `true` no MinIO |
| `AZURE_CONNECTION_STRING` | com `azure` | `(da conta de armazenamento)` | segredo; em produção `AZURE_CONNECTION_STRING_ARQUIVO` |
| `AZURE_CONTAINER` | com `azure` | `arquivos` | container privado |
| `ANTIVIRUS_HABILITADO` | não (padrão `false`) | `true` | liga a verificação com ClamAV |
| `CLAMAV_HOST` / `CLAMAV_PORTA` | com antivírus | `clamav` / `3310` | onde o ClamAV responde |

### Dependências

Pacotes novos na API: `busboy`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner` e `@azure/storage-blob`
(mais `@types/busboy`, `@testcontainers/minio` e `@testcontainers/azurite` só para os testes). Uma migração de banco (tabela `arquivo`).
Em produção, a skill de instalação precisa configurar o limite do Caddy, o volume e (se usar) o ClamAV: o arquivo `referencia/instalacao-upload.md` diz o quê.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro (o Docker precisa estar aberto: os testes
   sobem Postgres, MinIO e Azurite temporários).
3. Veja de verdade:
   - bash / Git Bash / macOS / Linux e PowerShell (iguais):
     ```bash
     docker compose up -d postgres
     pnpm --filter api db:migrate
     pnpm dev
     ```
   Entre no sistema, envie um PDF, e abra a pasta `apps/api/dados/arquivos`: os arquivos têm nomes de letras e números, nunca o nome original. Tente enviar um
   arquivo `.exe` renomeado para `.pdf` (o sistema recusa) e um arquivo maior que o limite (também). Em **Admin → Auditoria** aparecem `arquivo.enviar` e `arquivo.baixar`.
4. Antivírus (opcional): `docker compose --profile antivirus up -d clamav`, espere o contêiner ficar `healthy` (alguns minutos na primeira vez), ponha
   `ANTIVIRUS_HABILITADO=true` no `.env`, reinicie e envie um arquivo normal (passa). Com o ClamAV desligado, os envios passam a ser recusados (por segurança).

### Se não funcionar

- **Erro 413 em arquivo pequeno, em produção**: o Caddy (ou nginx) está com limite menor que `UPLOAD_MAX_MB`. Veja `request_body max_size` em `referencia/instalacao-upload.md`.
- **A API não sobe e o erro cita `ARMAZENAMENTO_SEGREDO_URL`**: em produção com `local` o segredo é obrigatório. Gere com `openssl rand -hex 32`.
- **Erro 415 num PDF de verdade**: o arquivo não começa como PDF (alguns programas colocam lixo antes do `%PDF-`). Gere o PDF de novo.
- **Erro 503 com o antivírus ligado**: o ClamAV está fora do ar ou ainda carregando. O sistema recusa de propósito (não guarda arquivo sem verificar).
- **Todo arquivo grande falha com o antivírus ligado**: o `StreamMaxLength` do ClamAV é menor que `UPLOAD_MAX_MB`; no compose do modelo é `600M`.
- **Link de download deu erro 403**: o link expirou (5 minutos, por padrão) ou foi alterado. Peça outro.
- **Os links pararam de valer depois de reiniciar (desenvolvimento)**: sem `ARMAZENAMENTO_SEGREDO_URL` o sistema usa uma chave nova a cada início. Defina uma no `.env`.

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
