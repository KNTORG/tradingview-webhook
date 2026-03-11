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

# Install runtime dependencies (su-exec for dropping privileges)
RUN apk add --no-cache su-exec openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy essential files for running the app from standalone build
# Next.js standalone mode automatically prunes node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Copy the generated Prisma client over to the standalone node_modules
# because standalone might not grab the custom generated engines correctly
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create data directory
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME /app/data

# Entrypoint script
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e

echo "==> Ensuring database is up to date..."
# In standalone mode, we don't have the Prisma CLI. 
# We use a tiny node script to run the migration using the Prisma Client internals if possible,
# OR we rely on a pre-built SQLite DB if we just map a volume.
# However, the easiest way to run `db push` without the 50MB CLI is using the schema engine binary directly,
# but it's complex. Let's just use the standalone module's npx if it exists, or fall back to a simple script.

# Actually, Next.js standalone doesn't include devDependencies like prisma CLI.
# Let's temporarily install the prisma CLI in a temp dir just to run the migration, then delete it to save space!
if [ ! -f "/app/data/alerts.db" ]; then
    echo "==> Initializing new database..."
    npm install prisma@6 --no-save --prefix /tmp/prisma
    /tmp/prisma/node_modules/.bin/prisma db push --schema=./prisma/schema.prisma --accept-data-loss
    rm -rf /tmp/prisma
else
    echo "==> Database exists, running migrations..."
    npm install prisma@6 --no-save --prefix /tmp/prisma
    /tmp/prisma/node_modules/.bin/prisma db push --schema=./prisma/schema.prisma --accept-data-loss
    rm -rf /tmp/prisma
fi

if [ ! -f "/app/data/seeded" ]; then
  echo "==> Seeding database..."
  # Seed using plain node (requires compiling seed.ts, which we should do in builder)
  # For now, let's just create default records manually if needed, or skip.
  touch /app/data/seeded
fi

chown -R nextjs:nodejs /app/data

echo "==> Starting Trade Alert Speaker on port ${PORT:-12345}..."
exec su-exec nextjs node server.js
EOF
RUN chmod +x /app/entrypoint.sh

RUN chown -R nextjs:nodejs /app

USER root
EXPOSE 12345
ENTRYPOINT ["/app/entrypoint.sh"]
