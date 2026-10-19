# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install all dependencies (including dev deps needed for the Nest build)
RUN npm ci

# Bundle app source
COPY . .

# Build the app (nest build -> dist/)
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built assets from the build stage
COPY --from=builder /usr/src/app/dist ./dist

# Run as a non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs && chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Cloud Run injects $PORT (defaults to 8080) and routes traffic to it;
# main.ts reads process.env.PORT via ConfigService, so no extra wiring is needed.
EXPOSE 8080

CMD ["node", "dist/main.js"]
