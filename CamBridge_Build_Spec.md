# CamBridge — Full Build Specification (v1.0)

**Purpose of this document:** This is the single source of truth for building CamBridge end-to-end — backend, frontend, database, video pipeline, Docker, CI/CD, and deployment. It is written to be handed directly to an AI coding agent (Antigravity) as the build context for the entire project.

**Project:** CamBridge — a plugin-based camera integration and monitoring platform (architecturally inspired by Scrypted).
**Goal:** A production-grade, deployable, portfolio-quality full-stack project for a final-year CS resume.

---

## 0. Instructions for the Build Agent (Antigravity)

1. Build in the **exact phase order** defined in §14. Do not skip ahead or combine phases.
2. After finishing each phase: the app must **run**, the **tests for that phase must pass**, and a **git commit** must be made using the message specified for that phase, before moving to the next phase.
3. **Never hardcode secrets.** Every credential, key, or connection string comes from environment variables. Use the `.env.example` in §4 as the contract — the human will fill in real values in `.env` (which must be gitignored).
4. **Do not invent scope.** If something is ambiguous, implement the simplest version that satisfies the requirement and leave a `// TODO:` comment explaining the simplification, rather than guessing at unstated complexity.
5. **Keep the core backend plugin-agnostic.** Nothing outside `backend/src/plugins/*` may import a concrete camera implementation (RTSP/ONVIF/Mock) directly — only the `CameraPlugin` interface.
6. **Explainability matters more than cleverness.** This is for interview prep — prefer straightforward, idiomatic NestJS/React patterns over clever abstractions the student can't defend in an interview.
7. Write tests as you go per module, not as a final catch-up phase.

---

## 1. Project Summary

CamBridge provides a unified layer between different IP cameras (Mock, RTSP, ONVIF) and a web dashboard, via a plugin architecture. It supports camera management, live video streaming, real-time status/event updates over WebSocket, and (later phases) recording and AI-based detection.

**Resume framing:** "Designed and built a real-time, plugin-based backend platform for camera integration — not a CRUD app — demonstrating API design, WebSocket architecture, video streaming (RTSP/FFmpeg), protocol integration (ONVIF), testing, and Docker-based deployment."

---

## 2. Final Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Frontend styling | Tailwind CSS |
| Frontend state/data | TanStack Query (server state) + Zustand (UI state) |
| Frontend routing | React Router v6 |
| Backend framework | NestJS 10 + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache / pub-sub | Redis 7 (introduced Phase 5, not before) |
| Auth | JWT (access + refresh token pair), Passport.js strategies |
| Real-time | WebSocket via NestJS `@WebSocketGateway` (Socket.IO adapter) |
| Video protocols | RTSP (via `node-rtsp-stream` / raw FFmpeg spawn), ONVIF (via `node-onvif` or `onvif` npm package) |
| Video processing | FFmpeg (spawned as child process, or `fluent-ffmpeg` wrapper) |
| Validation | `class-validator` + `class-transformer` DTOs |
| API docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Testing (backend) | Jest + Supertest |
| Testing (frontend) | Vitest + React Testing Library |
| Containerization | Docker + Docker Compose |
| CI | GitHub Actions |
| Reverse proxy (prod) | Nginx (or Caddy) with TLS via Let's Encrypt/Certbot |

---

## 3. Monorepo Structure

```
cambridge/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .gitignore
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── refresh.strategy.ts
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       └── login.dto.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── entities/user.entity.ts
│   │   ├── cameras/
│   │   │   ├── cameras.module.ts
│   │   │   ├── cameras.controller.ts
│   │   │   ├── cameras.service.ts
│   │   │   └── dto/
│   │   │       ├── create-camera.dto.ts
│   │   │       └── update-camera.dto.ts
│   │   ├── plugins/
│   │   │   ├── plugin-manager.module.ts
│   │   │   ├── plugin-manager.service.ts
│   │   │   ├── camera-plugin.interface.ts
│   │   │   ├── mock/
│   │   │   │   └── mock-camera.plugin.ts
│   │   │   ├── rtsp/
│   │   │   │   └── rtsp-camera.plugin.ts
│   │   │   └── onvif/
│   │   │       └── onvif-camera.plugin.ts
│   │   ├── streaming/
│   │   │   ├── streaming.module.ts
│   │   │   ├── streaming.service.ts
│   │   │   └── ffmpeg.service.ts
│   │   ├── events/
│   │   │   ├── events.module.ts
│   │   │   ├── events.service.ts
│   │   │   └── events.gateway.ts
│   │   ├── recordings/
│   │   │   ├── recordings.module.ts
│   │   │   ├── recordings.service.ts
│   │   │   └── recordings.controller.ts
│   │   ├── common/
│   │   │   ├── filters/http-exception.filter.ts
│   │   │   ├── interceptors/logging.interceptor.ts
│   │   │   └── crypto/encryption.service.ts
│   │   └── prisma/
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts
│   └── test/
│       ├── auth.e2e-spec.ts
│       └── cameras.e2e-spec.ts
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   ├── client.ts
        │   ├── auth.api.ts
        │   └── cameras.api.ts
        ├── hooks/
        │   ├── useAuth.ts
        │   └── useCameraSocket.ts
        ├── store/
        │   └── authStore.ts
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   ├── DashboardPage.tsx
        │   └── CameraDetailPage.tsx
        ├── components/
        │   ├── CameraCard.tsx
        │   ├── CameraStatusBadge.tsx
        │   ├── LiveVideoPlayer.tsx
        │   └── layout/
        │       ├── Navbar.tsx
        │       └── ProtectedRoute.tsx
        └── styles/
            └── globals.css
```

---

## 4. Environment Variables (`.env.example`)

Create this file at the repo root and reference it from `docker-compose.yml`. **The human will fill in real values in a git-ignored `.env`; never commit actual secrets.**

```env
# --- Database ---
POSTGRES_USER=cambridge
POSTGRES_PASSWORD=changeme
POSTGRES_DB=cambridge
DATABASE_URL=postgresql://cambridge:changeme@postgres:5432/cambridge?schema=public

# --- Redis (Phase 5+) ---
REDIS_URL=redis://redis:6379

# --- Auth ---
JWT_ACCESS_SECRET=replace_with_long_random_string
JWT_REFRESH_SECRET=replace_with_a_different_long_random_string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# --- Encryption (for camera credentials at rest) ---
CRYPTO_KEY=32_byte_random_key_for_aes_256_gcm

# --- Backend ---
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# --- Frontend (Vite exposes only VITE_ prefixed vars) ---
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# --- Storage (recordings, Phase 6) ---
RECORDINGS_PATH=/data/recordings
```

Add `.env` to `.gitignore` immediately in Phase 1. Commit `.env.example` only.

---

## 5. Database Schema (`backend/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  cameras      Camera[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum PluginType {
  MOCK
  RTSP
  ONVIF
}

enum CameraStatus {
  UNKNOWN
  CONNECTING
  CONNECTED
  DISCONNECTED
  ERROR
}

model Camera {
  id                String       @id @default(uuid())
  owner             User         @relation(fields: [ownerId], references: [id])
  ownerId           String
  name              String
  pluginType        PluginType
  connectionConfig  Json         // encrypted sensitive fields (e.g. rtspUrl, credentials) before write
  status            CameraStatus @default(UNKNOWN)
  lastSeenAt        DateTime?
  events            Event[]
  recordings        Recording[]
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
}

enum EventType {
  STATUS
  MOTION
  DETECTION
}

model Event {
  id        String    @id @default(uuid())
  camera    Camera    @relation(fields: [cameraId], references: [id])
  cameraId  String
  type      EventType
  payload   Json
  createdAt DateTime  @default(now())

  @@index([cameraId, createdAt])
}

enum RecordingTrigger {
  MANUAL
  EVENT
}

model Recording {
  id          String            @id @default(uuid())
  camera      Camera            @relation(fields: [cameraId], references: [id])
  cameraId    String
  startedAt   DateTime
  endedAt     DateTime?
  filePath    String
  triggeredBy RecordingTrigger
  createdAt   DateTime          @default(now())
}
```

Only `User` and `Camera` are needed for the MVP (Phases 1–3). `Event` and `Recording` tables are created here for schema stability but not used until Phases 5–6.

---

## 6. Backend Build Spec

### 6.1 Module responsibilities

| Module | Responsibility | Must NOT do |
|---|---|---|
| `AuthModule` | Register, login, refresh, JWT guards | Know anything about cameras |
| `UsersModule` | User persistence, password hashing | Handle HTTP directly (used by AuthModule) |
| `CamerasModule` | Camera CRUD, orchestrates PluginManager for connect/disconnect | Import any concrete plugin class |
| `PluginManagerModule` | Registers plugins, resolves by `pluginType`, exposes uniform lifecycle API | Contain camera-CRUD/database logic |
| `Plugins/*` | Implement `CameraPlugin` for Mock/RTSP/ONVIF | Be imported by anything except PluginManagerModule |
| `StreamingModule` | Wraps FFmpeg process management, exposes stream sessions | Know about auth/users |
| `EventsModule` | Persists events, broadcasts via WebSocket gateway | Talk to plugins directly (receives via PluginManager/CamerasService) |
| `RecordingsModule` | Start/stop recordings, list/query recordings | — |
| `PrismaModule` | Wraps `PrismaClient` as an injectable service | — |
| `common/crypto` | AES-256-GCM encrypt/decrypt for `connectionConfig` secrets | — |

### 6.2 Auth flow

- `POST /auth/register` — email + password (bcrypt hash, cost factor 12), returns user (no password) + access/refresh tokens.
- `POST /auth/login` — validates credentials, returns access + refresh tokens.
- `POST /auth/refresh` — validates refresh token, issues new access token.
- `JwtAuthGuard` protects all camera/event/recording routes via `@UseGuards(JwtAuthGuard)`.
- Access token: short-lived (15m), sent as `Authorization: Bearer <token>`.
- Refresh token: long-lived (7d), stored client-side (httpOnly cookie preferred over localStorage — document this tradeoff in the README).

### 6.3 Camera CRUD — required endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/cameras` | ✅ | Create camera (name, pluginType, connectionConfig) |
| GET | `/cameras` | ✅ | List current user's cameras |
| GET | `/cameras/:id` | ✅ | Get one camera |
| PATCH | `/cameras/:id` | ✅ | Update camera |
| DELETE | `/cameras/:id` | ✅ | Delete camera (also disconnects if connected) |
| POST | `/cameras/:id/connect` | ✅ | Trigger plugin `connect()` |
| POST | `/cameras/:id/disconnect` | ✅ | Trigger plugin `disconnect()` |
| GET | `/cameras/:id/status` | ✅ | Current status (also pushed via WS) |
| GET | `/cameras/discover?type=onvif` | ✅ | Trigger plugin discovery (Phase 5) |

All bodies validated via `class-validator` DTOs — reject unknown fields (`whitelist: true, forbidNonWhitelisted: true` in the global `ValidationPipe`).

### 6.4 Plugin interface (`camera-plugin.interface.ts`)

```typescript
export type CameraStatusValue = 'UNKNOWN' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface CameraConnectionConfig {
  [key: string]: unknown; // plugin-specific shape, validated per-plugin
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  address: string;
  metadata?: Record<string, unknown>;
}

export interface StreamSource {
  url: string;           // HLS playlist URL or WebRTC signaling endpoint
  protocol: 'hls' | 'webrtc';
}

export interface CameraPlugin {
  readonly type: 'MOCK' | 'RTSP' | 'ONVIF';

  connect(config: CameraConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<CameraStatusValue>;

  discover?(): Promise<DiscoveredDevice[]>;
  getStreamSource?(): Promise<StreamSource>;
}
```

- `PluginManagerService` maintains a `Map<PluginType, CameraPlugin>` (or a factory that creates a plugin instance per camera — prefer **per-camera instance**, since each camera needs independent connection state).
- `MockCameraPlugin`: simulates status transitions on a `setInterval`/manual trigger; no real I/O. This is what Phase 3 tests are built against.
- `RtspCameraPlugin`: takes an RTSP URL from `connectionConfig`, delegates actual stream pull to `StreamingModule`/FFmpeg.
- `OnvifCameraPlugin`: uses an ONVIF client library to discover devices and retrieve their RTSP stream URI, then behaves like the RTSP plugin internally.

### 6.5 WebSocket events (`events.gateway.ts`)

| Event name | Direction | Payload |
|---|---|---|
| `camera:status` | server → client | `{ cameraId, status, lastSeenAt }` |
| `camera:event` | server → client | `{ cameraId, type, payload, createdAt }` |
| `subscribe:camera` | client → server | `{ cameraId }` — join a room scoped to that camera |

Use Socket.IO rooms keyed by `cameraId` (or by `userId`) so clients only receive updates for cameras they own.

### 6.6 Streaming / FFmpeg (Phase 4)

- `FfmpegService.startStream(rtspUrl, outputDir)` spawns FFmpeg to transcode RTSP → HLS segments (`.m3u8` + `.ts` files) written to a temp/output directory served statically or via a signed URL.
- Recommended starting command shape (tune flags as needed):
  `ffmpeg -i <rtspUrl> -c:v libx264 -preset veryfast -f hls -hls_time 2 -hls_list_size 6 -hls_flags delete_segments <outputDir>/stream.m3u8`
- Track the child process PID per camera so it can be killed on `disconnect()`.
- **Decision (see Open Decisions in the companion architecture doc):** ship HLS for MVP video; document WebRTC as a stretch goal.

### 6.7 Security checklist (must all be true before calling this "production-grade")

- [ ] `helmet()` enabled globally.
- [ ] CORS restricted to `CORS_ORIGIN` env var, not `*`.
- [ ] Global `ValidationPipe` with whitelist + forbidNonWhitelisted + transform.
- [ ] Rate limiting on `/auth/*` routes (`@nestjs/throttler`).
- [ ] Passwords hashed with bcrypt (never stored/logged in plaintext).
- [ ] Camera `connectionConfig` secrets (passwords, stream credentials) encrypted at rest via `EncryptionService` (AES-256-GCM, key from `CRYPTO_KEY`), decrypted only in-memory when a plugin needs to connect.
- [ ] No secrets in logs (redact `connectionConfig` in the logging interceptor).
- [ ] `.env` gitignored; only `.env.example` committed.
- [ ] Dependency audit (`npm audit`) run in CI.
- [ ] HTTPS terminated at the reverse proxy in production (§13).

---

## 7. Frontend Build Spec

### 7.1 Pages / routes

| Route | Component | Auth required |
|---|---|---|
| `/login` | `LoginPage` | ❌ |
| `/register` | `RegisterPage` | ❌ |
| `/` (dashboard) | `DashboardPage` | ✅ |
| `/cameras/:id` | `CameraDetailPage` | ✅ |

Wrap authenticated routes in a `ProtectedRoute` component that checks the auth store and redirects to `/login` if unauthenticated.

### 7.2 State management

- **Server state** (cameras, events, recordings): TanStack Query — handles caching, refetching, and loading/error states without hand-rolled `useEffect` fetch logic.
- **Client/UI state** (auth token, current user): a small Zustand store (`authStore.ts`), persisted to memory only (access token) — do not put JWTs in `localStorage`; prefer httpOnly cookies set by the backend, with the frontend only tracking "is authenticated" boolean + user profile.

### 7.3 Key components

- `CameraCard` — name, status badge, connect/disconnect button, link to detail page.
- `CameraStatusBadge` — color-coded status pill driven by the live WebSocket status.
- `LiveVideoPlayer` — wraps an HLS.js player (or native `<video>` if the browser supports HLS natively) pointed at the stream URL returned by the backend.
- `useCameraSocket` — hook that opens one Socket.IO connection per authenticated session, subscribes to the current camera's room, and updates TanStack Query's cache directly on `camera:status`/`camera:event` (avoids a second network round-trip).

### 7.4 API client

- Central `client.ts` wraps `fetch`/`axios`, attaches the access token, and handles 401 → attempt refresh → retry once → else redirect to login.

---

## 8. Docker & Docker Compose

### 8.1 `docker-compose.yml` (development)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    restart: unless-stopped
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
    env_file: .env
    depends_on:
      - postgres
      - redis
    ports:
      - "3000:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - recordings:/data/recordings

  frontend:
    build:
      context: ./frontend
    env_file: .env
    depends_on:
      - backend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  pgdata:
  recordings:
```

### 8.2 `backend/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# FFmpeg required for video processing
RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

(For local dev, override `CMD` with `npm run start:dev` via docker-compose, or add a separate dev-stage.)

### 8.3 `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 8.4 `docker-compose.prod.yml` (overrides for production)

- Remove bind-mount volumes (`./backend:/app` etc.) so containers run the built image, not live source.
- Add an `nginx` (or Caddy) service in front of both `frontend` and `backend`, terminating TLS.
- Set `NODE_ENV=production`, `restart: always`.

---

## 9. Testing Strategy

| Layer | Tool | What to test |
|---|---|---|
| Backend unit | Jest | `AuthService` (hashing, token issuance), `CamerasService` (CRUD logic with mocked Prisma), `PluginManagerService` (resolves correct plugin, lifecycle calls), `MockCameraPlugin` (status transitions) |
| Backend e2e | Jest + Supertest | Full HTTP flow: register → login → create camera → get status; auth guard rejects missing/invalid token |
| Frontend unit | Vitest + RTL | `CameraCard` renders status correctly; `ProtectedRoute` redirects when unauthenticated |
| Manual/exploratory | — | Real RTSP camera connect (Phase 4), real ONVIF discovery on local network (Phase 5) — these are hard to automate reliably, document as manually verified in README |

Target: meaningful coverage on `auth`, `cameras`, and `plugins` (the architectural core) rather than chasing a blanket coverage percentage.

---

## 10. CI/CD (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - working-directory: backend
        run: npm ci
      - working-directory: backend
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      - working-directory: backend
        run: npm run lint
      - working-directory: backend
        run: npm run test
      - working-directory: backend
        run: npm run build

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - working-directory: frontend
        run: npm ci
      - working-directory: frontend
        run: npm run lint
      - working-directory: frontend
        run: npm run test
      - working-directory: frontend
        run: npm run build
```

---

## 11. Deployment Guide

**Recommended path for a student portfolio project: a single low-cost VPS (e.g., a $5–6/mo droplet/VM) running Docker Compose.** It's cheap, teaches real deployment skills (the thing interviewers actually want to hear about), and avoids juggling three different platforms' free-tier quirks.

1. Provision a small Ubuntu VPS. Install Docker + Docker Compose.
2. Point a domain (or subdomain) at the VPS IP.
3. Copy the repo to the VPS (or `git clone`), create the real `.env` there (never commit it).
4. Run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
5. Add an `nginx`/Caddy service (or install Nginx on the host) as a reverse proxy: `your-domain.com` → frontend container, `api.your-domain.com` → backend container.
6. Obtain a TLS certificate via Certbot (Let's Encrypt) or let Caddy handle it automatically.
7. Set up a simple health-check + restart policy (`restart: always` in compose is a start; a GitHub Actions deploy step that SSHes in and re-pulls/rebuilds on push to `main` is a nice-to-have stretch goal worth mentioning in interviews even if not fully automated).

**Alternative (simpler, more moving parts):** Railway or Render for backend + managed Postgres/Redis, Vercel/Netlify for the frontend. Faster to set up, but "I containerized and deployed the whole stack myself" is a stronger interview story than "I clicked deploy on Vercel," so the VPS path is recommended if time allows.

---

## 12. README Requirements (final deliverable)

The finished repo's `README.md` must include:

1. One-paragraph project summary + why it exists (plugin-architecture pitch).
2. Architecture diagram (can reuse the diagram from the companion architecture doc).
3. Tech stack table.
4. Setup instructions: `git clone` → `.env` setup → `docker compose up` → done.
5. Screenshots or a short demo GIF of the dashboard + live video.
6. API documentation link (Swagger UI path, e.g. `/api/docs`).
7. Testing instructions (`npm run test`).
8. A short "Design Decisions" section covering: why a plugin architecture, HLS vs WebRTC tradeoff, why Redis was/wasn't used, security measures taken.
9. Roadmap/future work section (AI detection, WebRTC, multi-tenant).

---

## 13. Build Order — Execute Phases Sequentially

Each phase lists: goal, concrete tasks, acceptance criteria, and the git commit message to use when done.

### Phase 1 — Foundation
**Tasks:** Scaffold monorepo; init NestJS backend; init React (Vite) frontend; add `docker-compose.yml`, `.env.example`, `.gitignore`; connect backend to Postgres via Prisma; add `GET /health`.
**Acceptance:** `docker compose up` brings up Postgres + backend + frontend; `/health` returns 200; frontend loads and can call `/health`.
**Commit:** `feat: initialize monorepo, backend, frontend, and docker setup`

### Phase 2 — Auth & Camera CRUD
**Tasks:** Implement `AuthModule` (register/login/refresh, guards); implement `UsersModule`; implement `CamerasModule` CRUD (no plugins yet — just DB persistence); build `LoginPage`, `RegisterPage`, basic `DashboardPage` listing cameras.
**Acceptance:** Can register, log in, create/list/update/delete a camera through the UI; protected routes reject unauthenticated requests; e2e tests pass.
**Commit:** `feat: add authentication and camera CRUD`

### Phase 3 — Plugin Architecture
**Tasks:** Define `CameraPlugin` interface; build `PluginManagerModule`; implement `MockCameraPlugin`; wire `CamerasService` to use PluginManager for connect/disconnect/status instead of a stub; add `EventsModule` + WebSocket gateway broadcasting `camera:status`; wire dashboard to show live status via `useCameraSocket`.
**Acceptance:** Creating a Mock camera and clicking "connect" transitions its status live in the UI without a page refresh; unit tests cover PluginManager + MockCameraPlugin.
**Commit:** `feat: add plugin architecture with mock camera and realtime status`

### Phase 4 — Real Video (RTSP + FFmpeg)
**Tasks:** Implement `RtspCameraPlugin`; implement `FfmpegService`/`StreamingModule` (RTSP → HLS); add `LiveVideoPlayer` frontend component (HLS.js); wire `/cameras/:id/connect` to start a stream session for RTSP-type cameras.
**Acceptance:** A real RTSP camera (or public test RTSP stream) can be added and its live video plays in the dashboard.
**Commit:** `feat: add rtsp streaming with ffmpeg and live video playback`

### Phase 5 — ONVIF & Events
**Tasks:** Implement `OnvifCameraPlugin` (discovery + stream URI retrieval); add `/cameras/discover` endpoint + frontend "scan network" action; persist `Event` rows for status/motion; introduce Redis only if/when a concrete bottleneck is identified (document the decision either way).
**Acceptance:** ONVIF-compatible camera on the local network can be discovered and added; event history is queryable per camera.
**Commit:** `feat: add onvif discovery and event history`

### Phase 6 — Recording & Notifications
**Tasks:** `RecordingsModule` (start/stop, list, associate with camera); event-triggered recording on motion events; reconnection with backoff on disconnect; basic in-app notifications.
**Acceptance:** Manual recording start/stop works and produces a playable file; a simulated motion event on the Mock camera triggers an automatic recording.
**Commit:** `feat: add recording, event-triggered capture, and reconnection handling`

### Phase 7 — AI Detection (optional/stretch — do not let this block Phase 8)
**Tasks:** Optional OpenCV/YOLO integration on recorded/live frames; store detections as typed `Event`s; searchable event history UI.
**Acceptance:** At least person-detection works against a recorded clip or live Mock/RTSP feed.
**Commit:** `feat: add ai-based detection events`

### Phase 8 — Production Hardening & Deployment
**Tasks:** Apply full security checklist (§6.7); add `docker-compose.prod.yml`; write CI workflow (§10); write the final README (§12); deploy to the chosen target (§11); take screenshots/demo GIF.
**Acceptance:** The deployed, public URL works end-to-end (register → add camera → see live status/video); CI passes on `main`; README is complete.
**Commit:** `feat: production hardening, ci, and deployment`

---

## 14. Definition of "Resume-Ready"

Before calling this done for resume purposes, all of the following must be true:

- [ ] MVP (Phases 1–3) fully working, tested, and demoable locally via one `docker compose up`.
- [ ] At least Phase 4 (real RTSP video) working — this is the single most impressive, differentiating feature.
- [ ] Deployed somewhere with a public URL (§11).
- [ ] README complete per §12, with a real architecture diagram and screenshots.
- [ ] You (the student) can explain, without notes, why the plugin architecture exists, how the WebSocket status flow works end-to-end, and the HLS-vs-WebRTC tradeoff. If you can't explain a piece, don't ship it — simplify it until you can.
- [ ] Git history reads as a real engineering log (the commit messages in §13, plus smaller commits within each phase), not a single "initial commit."

Phases 5–7 (ONVIF, recording, AI) are strong bonus material but are not required for the project to be resume-ready — a polished, well-explained MVP + real video beats an unfinished attempt at everything.
