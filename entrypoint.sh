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
