---
name: phase-1-foundation
description: Scaffold the CamBridge monorepo, Docker setup, and a working health check end to end.
---

## Prerequisites
- Node 20+, Docker, and Docker Compose installed
- `.env` created from `.env.example` at the repo root (see GEMINI.md)

## Steps
1. Create the monorepo root with `backend/` and `frontend/` as separate packages (see `docs/CamBridge_Build_Spec.md` §3 for the full folder tree).
2. Scaffold the backend: `npx @nestjs/cli new backend` (or equivalent), TypeScript, strict mode on.
3. Scaffold the frontend: `npm create vite@latest frontend -- --template react-ts`.
4. Add `prisma/schema.prisma` to `backend/` using the schema in `backend/prisma/schema.prisma` (already provided — do not redesign it).
5. Wire up `PrismaModule`/`PrismaService` in the backend and connect to Postgres using `DATABASE_URL` from `.env`.
6. Add a `GET /health` endpoint that returns `{ status: "ok" }` and confirms it can reach the database (a trivial `SELECT 1` via Prisma is enough).
7. Add `docker-compose.yml` (services: `postgres`, `redis`, `backend`, `frontend`) per `docs/CamBridge_Build_Spec.md` §8.1.
8. Add `.gitignore` covering `node_modules`, `.env`, `dist`, `build`.
9. Write a minimal root `README.md` with a one-paragraph description and a "Setup" section (`docker compose up`).

## Acceptance Criteria
- `docker compose up` brings up Postgres + backend + frontend with no manual steps beyond `.env` being filled in.
- `GET /health` returns 200 and confirms DB connectivity.
- Frontend loads in the browser and successfully calls `/health` (shown on screen, even minimally).

## Commit
`feat: initialize monorepo, backend, frontend, and docker setup`
