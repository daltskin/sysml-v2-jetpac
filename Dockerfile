# ── Stage 1: Build ──
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

# ── Stage 2: Production ──
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
RUN chown -R node:node /app
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.mjs"]
