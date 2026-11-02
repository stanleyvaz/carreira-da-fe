# Backend + web do Jornada. Build:  docker build -t jornada .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
RUN npm run build -w apps/web

FROM node:22-slim AS run
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
# Segredos (DATABASE_URL, NOTES_ENCRYPTION_KEY, APNS_*) vêm do ambiente da hospedagem, nunca da imagem.
CMD ["node", "apps/web/server.js"]
