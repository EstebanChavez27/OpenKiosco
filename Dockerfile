FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build -w apps/api && npm run build -w apps/web && npx prisma generate -s apps/api/prisma

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/src ./apps/api/src
COPY --from=build /app/apps/web/dist ./public

EXPOSE 3000

WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/server.ts"]
