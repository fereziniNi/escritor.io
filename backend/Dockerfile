FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# `sh ./mvnw` em vez de `./mvnw`: builds que sobem o contexto como arquivo (ex.: `railway up`,
# sem passar por um clone git de verdade) não preservam o bit de execução do mvnw - achado ao
# tentar fazer o primeiro deploy no Railway ("/bin/sh: 1: ./mvnw: Permission denied"). Rodar via
# `sh` não depende desse bit; o `./` continua obrigatório - sem ele o próprio mvnw erra ao
# calcular o diretório onde ele está ("cannot open mvnw/.mvn/wrapper/maven-wrapper.properties"),
# achado também tentando corrigir isto no Railway.
RUN sh ./mvnw -B dependency:go-offline

COPY src ./src
RUN sh ./mvnw -B clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
