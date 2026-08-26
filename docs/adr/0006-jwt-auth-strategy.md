# ADR 0006 — Estratégia de autenticação: access token em memória + refresh em cookie httpOnly

## Status
Aceito

## Contexto
O PRD (E0) pede JWT de curta duração + refresh token, com rotas protegidas por papel. Precisa de uma decisão de onde cada token vive no cliente, já que isso tem implicação direta de segurança (XSS/CSRF).

## Decisão
- **Access token:** JWT de vida curta (~15 min), enviado via header `Authorization: Bearer`, mantido apenas em memória no frontend (nunca em `localStorage`/`sessionStorage`).
- **Refresh token:** cookie `httpOnly` + `Secure` + `SameSite=Strict`, usado só pelo endpoint `POST /auth/refresh`. Rotacionado a cada uso (refresh token antigo invalidado).
- Bloqueio de conta por 5 tentativas falhas de login, controlado no backend.

## Alternativas consideradas
- **Ambos os tokens em `localStorage`:** mais simples de implementar, mas expõe o refresh token (de vida longa) a qualquer XSS na aplicação — risco desproporcional para o ganho de simplicidade.
- **Ambos em cookie httpOnly:** protegeria os dois de XSS, mas exigiria CSRF token para toda chamada de API autenticada (já que cookies são enviados automaticamente) — mais complexidade do que manter o access token em memória, que não sofre desse problema por ser enviado explicitamente no header.

## Consequências
- Refresh de página perde o access token em memória — o frontend precisa chamar `/auth/refresh` (que usa o cookie) na inicialização do app para obter um novo access token, antes de renderizar rotas protegidas.
- Logout precisa invalidar o refresh token no backend, não só limpar estado no cliente.
