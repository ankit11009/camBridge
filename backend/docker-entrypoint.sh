#!/bin/sh
set -e

echo "Generating Prisma client..."
npx prisma generate

echo "Waiting for database and applying schema..."
MAX_RETRIES=30
COUNT=0
until npx prisma db push --skip-generate || [ $COUNT -ge $MAX_RETRIES ]; do
  echo "Database not ready yet, retrying in 2 seconds... ($COUNT/$MAX_RETRIES)"
  COUNT=$((COUNT + 1))
  sleep 2
done

if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "Database migration failed after $MAX_RETRIES retries."
  exit 1
fi

echo "Seeding database (if needed)..."
npx prisma db seed || echo "Seed skipped or already applied."

echo "Starting CamBridge backend..."
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
elif [ -f "dist/main.js" ]; then
  exec node dist/main.js
else
  echo "Dist not found, building..."
  npm run build
  exec node dist/src/main.js
fi
