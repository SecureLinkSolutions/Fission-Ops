FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm test

FROM node:24-alpine
# git: the ingest shallow-clones the detection rule repositories.
RUN apk upgrade --no-cache && apk add --no-cache git
WORKDIR /app
ENV NODE_ENV=production \
    FIREWATCH_VAR=/var/lib/firewatch \
    PORT=8787
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY shared ./shared
COPY ingest ./ingest
COPY server ./server
COPY --from=builder /app/web/dist ./web/dist
RUN mkdir -p /var/lib/firewatch && chown node:node /var/lib/firewatch
USER node
VOLUME /var/lib/firewatch
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null 2>&1 || exit 1
CMD ["node", "server/server.ts"]
