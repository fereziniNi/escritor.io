# Tutorial — Dados pessoais (LGPD)

## Passos comuns

1. No escritor.io, abra o painel **Skills** e baixe o `.zip` da skill **lgpd-dados-pessoais**.
2. Extraia o zip em `<seu-projeto>/.claude/skills/` (vale para todos que usam o projeto) ou em `~/.claude/skills/`
   (só para você). Deve ficar `.claude/skills/lgpd-dados-pessoais/SKILL.md`.
3. Abra o Claude Code na pasta do projeto e confira que a skill aparece (digite `/skills`).
4. Cole o prompt de uso da skill.

## Parte específica desta skill

### Como funciona para quem usa o sistema

O CPF das pessoas fica **embaralhado (cifrado)** no banco de dados: quem copiar o banco não consegue ler os CPFs sem as
chaves, que ficam guardadas em outro lugar. Mesmo assim o sistema consegue procurar alguém pelo CPF. Quem tem o papel
**Usuário** vê o CPF e o e-mail das pessoas pela metade (`***.456.789-**`, `a***@exemplo.com.br`); **Gestor** e
**Administrador** veem completo. Os registros técnicos do sistema (logs) nunca mostram CPF nem e-mail. Quando uma pessoa pede
os próprios dados ou pede para ser apagada (direitos da LGPD), o administrador exporta um arquivo com tudo que o sistema
guarda dela ou a **anonimiza** (o nome vira "Titular anonimizado" e o CPF e o e-mail somem); as duas ações ficam na auditoria.
Depois do prazo combinado com o jurídico, um comando automático anonimiza quem já encerrou o relacionamento.

### Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Esqueleto do projeto | skills `novo-projeto-multiplica`, `identidade-visual`, `seguranca`, `email-transacional`, `usuarios-e-papeis`, `login-codigo-email` e `trilha-auditoria` já aplicadas | `ls apps/api/src/auditoria` ou `dir apps\api\src\auditoria` |
| Node.js | 22.22 ou mais nova | `node --version` |
| pnpm | 9.15.4 | `pnpm --version` |
| Docker | qualquer versão recente (Postgres de desenvolvimento e dos testes) | `docker version` |

### Variáveis de ambiente

| Nome | Obrigatória | Exemplo | Para que serve |
|---|---|---|---|
| `DADOS_CHAVES` ou `DADOS_CHAVES_ARQUIVO` | **sim em produção: sem ela a API não sobe**; em desenvolvimento (`NODE_ENV=development`) pode faltar | `DADOS_CHAVES=k1:<32 bytes em base64>` | chaves que cifram o CPF. Várias separadas por vírgula: a primeira cifra, as outras só leem (troca de chave). **Perder = perder os CPFs**: guarde no cofre do cliente |
| `DADOS_CHAVE_INDICE` ou `DADOS_CHAVE_INDICE_ARQUIVO` | sim, junto com a de cima | `DADOS_CHAVE_INDICE=<outros 32 bytes em base64>` | chave da busca por CPF. Tem de ser **diferente** das de cima e nunca é trocada |
| `RETENCAO_DIAS` | não (vazia: nada é apagado) | `1825` | dias depois do encerramento do cliente até ele ser anonimizado. O prazo vem do jurídico/DPO |
| `RETENCAO_AUDITORIA_IP_DIAS` | não (vazia: a auditoria fica intacta) | `730` | apaga o IP dos registros de auditoria mais velhos que isso. Só ligue com decisão escrita no `CLAUDE.md` |

Gerar uma chave (rode duas vezes: uma para `DADOS_CHAVES`, outra para `DADOS_CHAVE_INDICE`):

- bash / Git Bash / macOS / Linux: `openssl rand -base64 32`
- PowerShell: `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)`
  (nunca `Get-Random`)

No `.env` de desenvolvimento fica `DADOS_CHAVES=k1:<primeira>` e `DADOS_CHAVE_INDICE=<segunda>`. Em produção, cada uma num
arquivo de segredo (`DADOS_CHAVES_ARQUIVO=/run/secrets/dados_chaves`), nunca no git nem no chat.

### Dependências

Nenhum pacote novo. Cria a tabela de exemplo `cliente` (uma migração) e dois comandos: `lgpd:retencao` e `lgpd:recifrar`.

### Como verificar que funcionou

1. Abra um terminal **na pasta do projeto** (no VS Code: menu Terminal → Novo terminal; no Windows também serve o PowerShell).
2. Rode `pnpm install`, depois `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Todos terminam sem erro (os testes sobem um
   Postgres temporário; o Docker precisa estar aberto). Os testes provam que o CPF não fica legível no banco, que a troca de chave
   funciona, que o Usuário vê mascarado e que nenhum log tem CPF.
3. Veja o CPF cifrado no banco (com as chaves no `.env`):
   - bash / Git Bash / macOS / Linux e PowerShell (iguais):
     ```bash
     docker compose up -d postgres
     pnpm --filter api db:migrate
     pnpm dev
     ```
   Entre no sistema como administrador, cadastre um cliente de teste (pela tela do projeto, ou peça ao Claude Code para chamar
   `POST /api/clientes`) e depois rode:
   ```bash
   docker compose exec postgres psql -U app -d app -c "select nome, cpf_cifrado from cliente"
   ```
   A coluna `cpf_cifrado` começa com `k1:` e **não** mostra o CPF.
4. Rode a retenção (sem `RETENCAO_DIAS` ela só avisa que está desligada):
   ```bash
   pnpm --filter api lgpd:retencao
   ```
   A saída é uma linha com `"msg":"RETENCAO_DIAS não definida: nada expurgado"` (ou, com o prazo definido, quantos foram anonimizados).

### Trocar a chave (uma vez por ano, ou se houver suspeita de vazamento)

1. Gere uma chave nova e ponha **na frente**: `DADOS_CHAVES=k2:<nova>,k1:<antiga>`. Reinicie a API.
2. Rode `pnpm --filter api lgpd:recifrar` (em produção, no serviço de migração: `node dist/lgpd/executar-lgpd.js recifrar`).
3. Só depois retire a antiga: `DADOS_CHAVES=k2:<nova>`. Não troque `DADOS_CHAVE_INDICE`.

### Se não funcionar

- **A API não sobe e o erro cita `DADOS_CHAVES`**: em produção (ou com `NODE_ENV` ausente) as duas chaves são obrigatórias. Defina-as
  (tabela acima). Em desenvolvimento, falta `NODE_ENV=development` no `.env`.
- **"precisa ter 32 bytes em base64 padrão"**: a chave foi copiada pela metade, com espaço ou gerada de outro jeito. Gere de novo com
  o comando acima e não esqueça o `k1:` na frente (só em `DADOS_CHAVES`).
- **"tem de ser diferente de todas as chaves"**: `DADOS_CHAVE_INDICE` foi preenchida com a mesma chave de `DADOS_CHAVES`. Gere outra.
- **Erro 500 ao listar clientes e o log fala em "não foi possível decifrar"**: a chave que cifrou aqueles dados não está mais em
  `DADOS_CHAVES` (foi trocada sem o passo 2 da troca, ou o `.env` de desenvolvimento estava sem chaves e a API reiniciou). Volte a
  chave antiga para a lista; em desenvolvimento, apague os clientes de teste.
- **O Usuário vê o CPF inteiro**: confira o papel dele em **Usuários** (Gestor e Administrador veem completo de propósito).

Próximo passo: seguir a ordem de skills indicada pelo Claude Code.
