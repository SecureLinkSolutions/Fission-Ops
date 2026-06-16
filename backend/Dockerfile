FROM node:24-alpine AS builder
# Upgrade Alpine packages to patch openssl and other vulnerabilities
RUN apk upgrade --no-cache
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:24-alpine
# Upgrade Alpine packages to patch openssl and other vulnerabilities
RUN apk upgrade --no-cache
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY db /db
EXPOSE 3001
CMD ["node", "dist/index.js"]
