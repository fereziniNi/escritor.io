# Sistema de Presença, Ponto e Tarefas

Ambiente único onde a equipe registra jornada (ponto), organiza tarefas (kanban) e enxerga quem está disponível (escritório virtual 2D, estilo Gather). Ver visão de produto completa em [docs/prd.md](docs/prd.md).

- **Escala:** até 10 usuários simultâneos
- **Stack:** React + TypeScript (Vite) / Spring Boot + Maven / PostgreSQL
- **Metodologia:** TDD, desenvolvimento incremental full-stack (fatia vertical por vez, front e back juntos)

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/prd.md](docs/prd.md) | Visão de produto, modelo de dados, épicos, roadmap |
| [docs/architecture.md](docs/architecture.md) | Stack, estrutura de pastas, camadas, decisões de arquitetura |
| [docs/testing-strategy.md](docs/testing-strategy.md) | Pirâmide de testes, ferramentas por camada, workflow TDD |
| [docs/incremental-plan.md](docs/incremental-plan.md) | Backlog de fatias verticais da Fase 1 (E0+E1), em ordem de execução |
| [docs/adr/](docs/adr/) | Registro das decisões técnicas (ADRs) e o porquê de cada uma |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Como rodar o projeto localmente |

## Status

Fase atual: **documentação e planejamento**. Nenhum código foi escrito ainda — o scaffold de `/backend` e `/frontend` começa na próxima fase, seguindo a primeira fatia de [docs/incremental-plan.md](docs/incremental-plan.md).
