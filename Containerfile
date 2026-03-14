# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
# We need prisma to generate the client later, so install it
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for alpine specifically
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Remove the bloated prisma CLI from node_modules, keep only the client
# Next.js standalone copies what it needs, but we need the client for migrations/runtime
RUN rm -rf node_modules/prisma && \
    rm -rf node_modules/@prisma/engines

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=12345
ENV HOSTNAME="0.0.0.0"
ENV TZ="Asia/Bangkok"
ENV NEXT_PUBLIC_TZ="Asia/Bangkok"

# Install runtime dependencies (su-exec for dropping privileges)
RUN apk add --no-cache su-exec openssl avahi-tools

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy essential files for running the app from standalone build
# Next.js standalone mode automatically prunes node_modules
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nextjs:nodejs --from=builder /app/package.json ./package.json

# Copy the generated Prisma client over to the standalone node_modules
# because standalone might not grab the custom generated engines correctly
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=nextjs:nodejs --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create data directory
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME /app/data

# Entrypoint script
COPY --chown=nextjs:nodejs entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER root
EXPOSE 12345
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:12345/api/health || exit 1
ENTRYPOINT ["/app/entrypoint.sh"]
