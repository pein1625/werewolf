# node:sqlite là module built-in, cần Node 24. Đừng hạ version base image.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV WEREWOLF_DB=/data/werewolf.db

# Chỉ cài dependencies chạy thật. tsx nằm trong dependencies vì `npm start` gọi nó.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/src ./src
# test/ đi kèm để deploy tự động chạy được cổng chặn ngay trong image
COPY --from=build /app/test ./test

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3000
CMD ["npm", "start"]
