# origem: skills-modelo/Dockerfile
# Imagem única do sistema (skill instalacao-docker-compose). A MESMA imagem roda os três serviços do deploy/docker-compose.yml,
# escolhidos por ROLE: migrar (migrações + papel de runtime + fila, com o dono do banco), api (porta 3000, serve também o SPA)
# e worker (fila de tarefas). Build, na pasta do projeto:
#   docker build -t registro.exemplo.com.br/sistema:1.4.0 --build-arg APP_VERSAO=1.4.0 --build-arg APP_COMMIT=$(git rev-parse --short HEAD) .
# Tag sempre com a versão (nunca latest): é ela que permite voltar para a versão anterior.

ARG NODE_IMAGEM=node:22.22.0-alpine3.22

# 1) Dependências e build (tem devDependencies, compiladores e o código-fonte; nada disto vai para a imagem final).
FROM ${NODE_IMAGEM} AS build
WORKDIR /src
RUN corepack enable
# Só os manifestos primeiro: a camada do pnpm install fica em cache enquanto as dependências não mudarem.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contratos/package.json packages/contratos/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter contratos build \
 && pnpm --filter api build \
 && pnpm --filter web build \
 && pnpm --filter api deploy --prod /saida/api \
 && rm -rf /saida/api/src /saida/api/test

# 2) Imagem final: só Node, o build da API com as dependências de produção e o build da web.
FROM ${NODE_IMAGEM}
ARG APP_VERSAO=dev
ARG APP_COMMIT=desconhecido
# production SEMPRE (inclusive homologação): cookie __Host-sessao com Secure, MAIL_MODE=log recusado, segredos obrigatórios.
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST=/app/web \
    ARMAZENAMENTO_PASTA=/dados/arquivos \
    APP_VERSAO=${APP_VERSAO} \
    APP_COMMIT=${APP_COMMIT}
WORKDIR /app
# Arquivos da aplicação são do root e só leitura para o processo; o único lugar gravável é /dados/arquivos (volume).
COPY --from=build /saida/api ./
COPY --from=build /src/apps/web/dist ./web
RUN mkdir -p /dados/arquivos && chown node:node /dados/arquivos
# Usuário sem privilégios que a imagem oficial do Node já traz (uid 1000).
USER node
EXPOSE 3000
# api: /api/health responde 200. worker e migrar não escutam porta: o healthcheck só confirma que o processo está de pé.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const r=process.env.ROLE;if(r==='worker'||r==='migrar')process.exit(0);fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(x=>process.exit(x.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
