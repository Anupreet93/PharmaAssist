# Backend/Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# use non-root user
USER appuser
EXPOSE 8080
# Ensure your server listens on process.env.PORT (README suggests 8080)
CMD ["node", "server.js"]
