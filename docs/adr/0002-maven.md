# ADR 0002 — Maven como build tool do backend

## Status
Aceito

## Contexto
Precisa de um build tool para o backend Spring Boot com boa integração a Flyway e Testcontainers.

## Decisão
Maven.

## Alternativas consideradas
- **Gradle:** build incremental mais rápido em projetos grandes e DSL mais flexível, mas curva de configuração maior e menos previsível para um projeto que começa do zero com um time pequeno. O ganho de performance de build não é relevante na escala deste projeto.

## Consequências
- `pom.xml` como fonte única de dependências e plugins.
- Plugins de Flyway e Testcontainers via Maven, sem necessidade de scripts customizados.
