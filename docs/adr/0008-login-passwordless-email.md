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
- Um novo código só é gerado se o anterior já expirou **ou** se já passou um cooldown de 30s desde que foi criado — dentro do cooldown, `POST /auth/codigo` é um no-op silencioso (mesma resposta 202). Sem isso, qualquer um que soubesse o e-mail de alguém poderia spammar o endpoint pra invalidar o código da vítima toda vez que ela tentasse usá-lo, um griefing barato.
- 5 tentativas erradas de verificação **matam aquele código específico** (não bloqueiam a conta) — o usuário só precisa pedir um novo.
- E-mail enviado via Spring Mail, contra Mailpit em dev (`docker-compose.yml`, UI em `localhost:8025`) — nada sai de verdade localmente. O envio é best-effort: se `mailSender.send()` lançar (SMTP fora do ar, por exemplo), a exceção é capturada e só logada — `POST /auth/codigo` continua respondendo 202 igual, porque um 500 ali só para e-mails cadastrados reabriria o oráculo que a resposta idêntica existe pra fechar.
- `POST /auth/login` com e-mail inexistente também executa uma comparação de hash (contra um hash fantasma pré-computado) antes de rejeitar — sem isso, a ausência da chamada ao BCrypt para e-mails desconhecidos criava uma diferença de tempo de resposta mensurável, dando outro jeito de enumerar quais e-mails estão cadastrados.
- `POST /auth/refresh` confere se o usuário do token continua ativo antes de emitir novos tokens — sem isso, um usuário desativado no futuro (quando existir esse endpoint) continuaria renovando sessão por até 30 dias com um refresh token emitido antes da desativação.

## Alternativas consideradas
- **Manter senha + adicionar 2FA por e-mail depois:** era o plano original, mas o usuário preferiu simplificar direto para passwordless — menos superfície (nenhuma senha para vazar, resetar ou reusar entre sistemas) e mais adequado a um time de até 10 pessoas onde a fricção de "criar e lembrar senha" não compensa.
- **Magic link (URL clicável) em vez de código numérico:** mais comum em produtos consumer, mas exige abrir o link no mesmo navegador/dispositivo onde o login foi iniciado — código numérico digitável funciona em qualquer dispositivo e é mais simples de implementar sem uma rota pública de callback.
- **Hashear o código com o mesmo algoritmo do CPF/e-mail (SHA-256 simples):** BCrypt é mais lento que o necessário para um código de 6 dígitos (o espaço de busca é pequeno, a proteção real vem do rate-limit + expiração), mas reaproveitar o `PasswordEncoder` já configurado evita introduzir uma segunda dependência de hashing só para isso.

## Consequências
- `CriarUsuarioRequest`/`Usuario` da fatia S1.2 tiveram que remover o campo de senha — documentado no commit correspondente, não como uma migração V2 revertendo V1 (o schema nunca foi implantado em lugar nenhum, então editar a V1 direto é mais honesto que empilhar uma migração que desfaz a anterior).
- Todo login depende de e-mail estar funcionando — se o SMTP cair, ninguém entra no sistema. Aceitável na escala do projeto; se isso incomodar no futuro, um plano B (ex.: login por admin/impersonation) fica para quando for um problema real.
- Não há "esqueci minha senha" para construir — o próprio login já é a recuperação.
