# ADR 0005 — TanStack Query + Zustand no frontend

## Status
Aceito

## Contexto
O critério de aceite do drag-and-drop do kanban (PRD E2) exige atualização otimista na UI com rollback automático se a API falhar. O mapa (E5) precisa de estado de cliente de alta frequência (posição do avatar) que não é, estritamente, "dado de servidor" a cada frame.

## Decisão
- **TanStack Query** para todo dado que vem do servidor: usuários, jornada, quadros, cards, apontamentos. Cobre cache, refetch e mutações otimistas com rollback nativamente.
- **Zustand** para estado de cliente que não pertence ao servidor: posição local do avatar antes de confirmar, estado de UI (drag em andamento, filtros).

## Alternativas consideradas
- **Redux Toolkit / RTK Query:** resolveria os dois casos com uma ferramenta só, mas com mais boilerplate (slices, actions, thunks) para um time pequeno. TanStack Query cobre o caso de uso de "cache de servidor com rollback" com bem menos código, e Zustand é suficientemente simples para o pouco estado de cliente que sobra.

## Consequências
- Regra clara para evitar duplicação: se o dado tem origem numa chamada de API, vive no TanStack Query — nunca é copiado para uma store Zustand "pra ficar mais fácil de acessar".
- Teste de rollback otimista do kanban (E2E, ver [testing-strategy.md](../testing-strategy.md)) simula falha de API e verifica que o TanStack Query reverte a UI sozinho.
