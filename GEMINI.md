# CamBridge — Agent Project Context

Read this file first, every session, before touching any code.

## What we're building
CamBridge: a plugin-based camera integration and monitoring platform (Mock / RTSP / ONVIF cameras), architecturally inspired by Scrypted. This is a final-year CS portfolio project — it must be real, working, and defensible in interviews, not just AI-generated volume.

## Tech stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind + TanStack Query + Zustand
- **Backend:** NestJS 10 + TypeScript + Prisma + PostgreSQL 16 + Redis 7 (Phase 5+ only) + JWT auth
- **Video:** RTSP + ONVIF + FFmpeg → HLS
- **Testing:** Jest + Supertest (backend), Vitest + React Testing Library (frontend)
- **Infra:** Docker Compose, GitHub Actions CI, Nginx reverse proxy in production

## Non-negotiable rules
1. Build **one phase at a time, in order**. Each phase's workflow is in `.agents/workflows/phase-N-*.md`. Do not begin phase N+1 until phase N's acceptance criteria pass and its commit has been made.
2. **Never hardcode secrets.** Every credential comes from environment variables — see `.env.example` at the repo root for exact variable names. `.env` itself must stay gitignored.
3. The core backend (`backend/src/auth`, `backend/src/cameras`, etc.) must **never import a concrete plugin** (Mock/RTSP/ONVIF) directly — only `backend/src/plugins/camera-plugin.interface.ts`. This boundary is the entire point of the architecture. Do not weaken it for convenience.
4. Prefer simple, idiomatic NestJS/React over clever abstractions. A human has to explain this code in interviews, not just run it.
5. If a requirement is ambiguous, implement the simplest version and leave a `// TODO:` comment explaining the simplification. Do not silently invent scope.
6. Write tests alongside each module as you build it, not as a catch-up phase at the end.
7. Use conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). One meaningful commit per completed step — not one giant commit per phase.

## Where the details live
| File | Contents |
|---|---|
| `docs/CamBridge_Requirements_and_Architecture.md` | Functional/non-functional requirements, system boundaries, module boundaries, plugin rationale |
| `docs/CamBridge_Build_Spec.md` | Full monorepo structure, API reference, Docker/CI/deployment configs, security checklist |
| `backend/prisma/schema.prisma` | The actual database schema — source of truth, not just docs |
| `.env.example` | Every environment variable the app needs, with placeholder values |
| `.agents/workflows/` | One file per build phase — work through them in numeric order |

## Definition of "done"
- MVP (phases 1–3) fully working via a single `docker compose up`.
- At least phase 4 (real RTSP video) working.
- Deployed with a public URL.
- README complete with architecture diagram, screenshots, and a "Design Decisions" section.
- Every design decision here can be explained by the student, unprompted, without notes.
