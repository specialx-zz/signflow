FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY prisma ./prisma/
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /app

# 보안: 비-root 사용자
RUN addgroup -g 1001 vuesign && adduser -u 1001 -G vuesign -s /bin/sh -D vuesign

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY src ./src/

# 업로드 디렉토리
RUN mkdir -p /app/uploads && chown -R vuesign:vuesign /app

USER vuesign
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3001/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
