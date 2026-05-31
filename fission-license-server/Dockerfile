FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/db/schema.sql ./src/db/schema.sql
COPY --from=builder /app/src/admin-ui ./src/admin-ui
EXPOSE 3002
CMD ["node", "dist/index.js"]
