# ADR 0006 — Estratégia de autenticação: access token em memória + refresh em cookie httpOnly

## Status
Aceito

## Contexto
O PRD (E0) pede JWT de curta duração + refresh token, com rotas protegidas por papel. Precisa de uma decisão de onde cada token vive no cliente, já que isso tem implicação direta de segurança (XSS/CSRF). Esta ADR cobre só o formato/transporte dos tokens emitidos **depois** que o login já foi validado — o mecanismo de login em si (passwordless por e-mail) está na [ADR 0008](0008-login-passwordless-email.md).

## Decisão
- **Access token:** JWT de vida curta (~15 min), enviado via header `Authorization: Bearer`, mantido apenas em memória no frontend (nunca em `localStorage`/`sessionStorage`).
- **Refresh token:** cookie `httpOnly` + `Secure` + `SameSite=Strict`, usado só pelo endpoint `POST /auth/refresh`. Rotacionado a cada uso (refresh token antigo invalidado).

## Alternativas consideradas
- **Ambos os tokens em `localStorage`:** mais simples de implementar, mas expõe o refresh token (de vida longa) a qualquer XSS na aplicação — risco desproporcional para o ganho de simplicidade.
- **Ambos em cookie httpOnly:** protegeria os dois de XSS, mas exigiria CSRF token para toda chamada de API autenticada (já que cookies são enviados automaticamente) — mais complexidade do que manter o access token em memória, que não sofre desse problema por ser enviado explicitamente no header.

## Consequências
- Refresh de página perde o access token em memória — o frontend precisa chamar `/auth/refresh` (que usa o cookie) na inicialização do app para obter um novo access token, antes de renderizar rotas protegidas.
- Logout precisa invalidar o refresh token no backend, não só limpar estado no cliente.
- **Rotação de uso único exige um mutex no cliente.** Como o refresh token vira inválido no primeiro uso, duas chamadas de API que percam a validade do access token ao mesmo tempo (ex.: duas queries disparadas em paralelo ao carregar uma tela) não podem cada uma chamar `/auth/refresh` por conta própria — a segunda perderia a corrida, seria tratada como reuso, e o backend revogaria *todos* os refresh tokens ativos do usuário como sinal de possível roubo (ver `AutenticacaoService.renovarToken`), derrubando a sessão por causa de tráfego legítimo. `shared/api/http.ts` (`apiFetch`) resolve isso fazendo todas as chamadas 401 concorrentes compartilharem a mesma promise de renovação em andamento, em vez de cada uma disparar sua própria `POST /auth/refresh`.
