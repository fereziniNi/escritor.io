FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# .template (não .conf direto): deploy no Railway precisa do endereço do backend resolvido em
# runtime, não no build da imagem (ver comentário no topo do nginx.conf.template) - a imagem
# oficial do Nginx já processa qualquer /etc/nginx/templates/*.template com envsubst
# automaticamente antes de subir, sem precisar de um entrypoint customizado.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
