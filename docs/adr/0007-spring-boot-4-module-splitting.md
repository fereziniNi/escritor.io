# ADR 0007 — Como lidar com o fatiamento de módulos do Spring Boot 4 (e outras armadilhas da stack atual)

## Status
Aceito (registro de padrão operacional, não uma escolha de arquitetura)

## Contexto
O Spring Boot 4 fatiou agressivamente o que antes eram poucos artefatos grandes (`spring-boot-autoconfigure`, `spring-boot-test-autoconfigure`) em dezenas de módulos pequenos por funcionalidade. Isso já causou builds vermelhos por dependência faltando, não por erro de código, em várias fatias:

- `TestRestTemplate` foi removido (substituído por `RestTestClient`, em `spring-test`).
- O autoconfigure do Flyway saiu de `spring-boot-autoconfigure` para `spring-boot-flyway`.
- `@DataJpaTest`/`TestEntityManager`/`@AutoConfigureTestDatabase` saíram para `spring-boot-data-jpa-test` / `spring-boot-jpa-test` / `spring-boot-jdbc-test`.
- `@WebMvcTest` saiu para `spring-boot-webmvc-test`.
- A integração do Spring Security com MockMvc (o que faz `@WithMockUser` funcionar) saiu para `spring-boot-starter-security-test` — sem ela, `@WithMockUser` é silenciosamente ignorado e todo request vira 403/401 incorreto, sem nenhum erro de compilação avisando.

O padrão do sintoma: compila e roda, mas o comportamento em runtime está errado (classe não encontrada é fácil de notar; autoconfiguração ausente não é).

Duas armadilhas relacionadas, mas fora do fatiamento em si, também já morderam:

- **Jackson 3, não 2.** O Boot 4 trocou para Jackson 3 (`tools.jackson.core:jackson-databind`, pacote `tools.jackson.databind.*`), não mais `com.fasterxml.jackson.databind`. Bibliotecas terceiras que ainda esperam Jackson 2 (ex.: `jjwt-jackson`) trazem esse Jackson 2 antigo como dependência transitiva em vez de reusar o do Boot — funciona, mas polui o classpath com duas versões. Preferir uma alternativa sem esse choque quando existir (usamos `jjwt-gson` em vez de `jjwt-jackson` por isso).
- **`/error` precisa ser público no `SecurityConfig`.** O forward interno do Boot para `/error` depois de qualquer resposta de erro reentra na mesma cadeia de segurança, agora como request anônima. Se `/error` não estiver em `permitAll()`, um 403 legítimo (usuário autenticado sem permissão) vira 401 (o entry point de "não autenticado" processa o forward e sobrescreve o status antes do corpo ser escrito) — sintoma muito enganoso porque parece um bug de autenticação quando na verdade é só essa rota faltando.

## Decisão
Quando uma funcionalidade nova do Spring Boot/Spring Security/Spring Data não funciona como esperado nesta versão (4.1.x) e não há nenhum erro óbvio, o primeiro passo é assumir que falta um módulo, não que o código está errado:

1. Procurar no `~/.m2/repository/org/springframework/boot/` por um artefato com nome parecido (`spring-boot-<feature>`, `spring-boot-<feature>-test`, `spring-boot-starter-<feature>-test`).
2. Se não achar localmente, inspecionar o `.pom` do artefato correspondente no Maven Central para ver do que ele depende.
3. Confirmar o pacote real da classe abrindo o `.jar` (`unzip -l`) antes de escrever o import — os pacotes também mudam (ex.: `org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase`, não mais `org.springframework.boot.test.autoconfigure.jdbc`).

## Alternativas consideradas
- **Fixar Spring Boot 3.x** para evitar essa fricção: rejeitado — o projeto está começando do zero agora, não há custo de migração a evitar, e ficar na versão antiga só adia o problema.

## Consequências
- Cada nova área do Spring Boot tocada pela primeira vez (mail, cache, batch, etc.) tem risco de precisar de um módulo de teste adicional não óbvio — orçar esse tempo de investigação nas próximas fatias.
- `backend/pom.xml` é a fonte da verdade de quais módulos foram necessários; não há necessidade de manter uma lista paralela aqui.
