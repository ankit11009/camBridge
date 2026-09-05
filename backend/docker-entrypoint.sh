#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting CamBridge backend..."
exec node dist/main.js
