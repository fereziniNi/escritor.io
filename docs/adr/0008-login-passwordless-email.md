# ADR 0008 — Login passwordless por e-mail (código de acesso)

## Status
Aceito

## Contexto
O PRD original (E0) previa login com email + senha (BCrypt). O usuário decidiu, ainda na Fase 1, que não quer senha nenhuma no sistema — login deve ser só e-mail + código de uso único enviado por e-mail. Essa decisão veio depois que a fatia S1.2 (`POST /usuarios`) já estava implementada com um campo de senha, exigindo revert daquele código (ver commit que remove `senha_hash`/`senha` de `Usuario`/`CriarUsuarioRequest`).

## Decisão
- `Usuario` não tem nenhum campo de credencial. Cadastro (S1.2, ADMIN) só pede nome, email, papel e carga diária.
- Login em dois passos:
  1. `POST /auth/codigo` `{email}` — se existir um usuário ativo com esse e-mail, gera um código numérico de 6 dígitos, guarda o **hash** dele (nunca texto puro) em `CodigoAcesso` com expiração de 10 minutos, e envia por e-mail. **Resposta idêntica** exista ou não o e-mail — não dá para usar esse endpoint para descobrir quem está cadastrado.
  2. `POST /auth/login` `{email, codigo}` — valida o código (existe, não expirou, não foi usado, não passou de 5 tentativas) e emite os tokens (ver ADR 0006).
- Um novo código pedido antes do anterior expirar invalida o anterior — só o mais recente é válido.
- 5 tentativas erradas de verificação **matam aquele código específico** (não bloqueiam a conta) — o usuário só precisa pedir um novo.
- E-mail enviado via Spring Mail, contra Mailpit em dev (`docker-compose.yml`, UI em `localhost:8025`) — nada sai de verdade localmente.

## Alternativas consideradas
- **Manter senha + adicionar 2FA por e-mail depois:** era o plano original, mas o usuário preferiu simplificar direto para passwordless — menos superfície (nenhuma senha para vazar, resetar ou reusar entre sistemas) e mais adequado a um time de até 10 pessoas onde a fricção de "criar e lembrar senha" não compensa.
- **Magic link (URL clicável) em vez de código numérico:** mais comum em produtos consumer, mas exige abrir o link no mesmo navegador/dispositivo onde o login foi iniciado — código numérico digitável funciona em qualquer dispositivo e é mais simples de implementar sem uma rota pública de callback.
- **Hashear o código com o mesmo algoritmo do CPF/e-mail (SHA-256 simples):** BCrypt é mais lento que o necessário para um código de 6 dígitos (o espaço de busca é pequeno, a proteção real vem do rate-limit + expiração), mas reaproveitar o `PasswordEncoder` já configurado evita introduzir uma segunda dependência de hashing só para isso.

## Consequências
- `CriarUsuarioRequest`/`Usuario` da fatia S1.2 tiveram que remover o campo de senha — documentado no commit correspondente, não como uma migração V2 revertendo V1 (o schema nunca foi implantado em lugar nenhum, então editar a V1 direto é mais honesto que empilhar uma migração que desfaz a anterior).
- Todo login depende de e-mail estar funcionando — se o SMTP cair, ninguém entra no sistema. Aceitável na escala do projeto; se isso incomodar no futuro, um plano B (ex.: login por admin/impersonation) fica para quando for um problema real.
- Não há "esqueci minha senha" para construir — o próprio login já é a recuperação.
