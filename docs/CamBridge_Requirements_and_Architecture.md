# CamBridge — Requirements & Initial Architecture

**Companion document to:** CamBridge Project Plan
**Purpose:** Convert the project brief into concrete functional/non-functional requirements, system boundaries, and a first-pass architecture that Phase 1–3 development can be built against.

---

## 1. Functional Requirements

Grouped by roadmap phase, so each phase has a clear "done" definition.

### FR-1 — Foundation (Phase 1)
- FR-1.1 Monorepo containing `backend/` (NestJS) and `frontend/` (React) as separate packages.
- FR-1.2 Backend boots and exposes a health-check endpoint (`GET /health`).
- FR-1.3 Backend connects to PostgreSQL on startup and fails loudly if it cannot.
- FR-1.4 Frontend boots and can call the backend health-check endpoint successfully.
- FR-1.5 `docker-compose.yml` brings up Postgres (+ later Redis) for local dev with one command.

### FR-2 — Authentication & Camera Management (Phase 2)
- FR-2.1 User can register with email + password.
- FR-2.2 User can log in and receive a JWT.
- FR-2.3 Protected routes reject requests without a valid JWT (401).
- FR-2.4 Authenticated user can create, list, update, and delete camera records (CRUD).
- FR-2.5 Each camera record has at minimum: name, type/plugin id, connection config (JSON), status (unknown/connected/disconnected/error), createdAt/updatedAt.
- FR-2.6 Basic dashboard lists the user's cameras and their current status.

### FR-3 — Plugin Architecture (Phase 3)
- FR-3.1 A `CameraPlugin` interface defines the contract every camera type must implement (see §6).
- FR-3.2 A Plugin Manager registers available plugins at startup and exposes them to the rest of the backend by plugin id.
- FR-3.3 Plugin lifecycle methods are supported: `discover()`, `connect()`, `disconnect()`, `getStatus()`.
- FR-3.4 A Mock Camera Plugin implements the interface and simulates connect/disconnect/status transitions on a timer or manual trigger.
- FR-3.5 The core backend (auth, camera CRUD, API layer) has zero references to any concrete camera type — only to the `CameraPlugin` interface.
- FR-3.6 Camera status changes are pushed to connected frontend clients over WebSocket in real time.

### FR-4 — Real Video (Phase 4)
- FR-4.1 An RTSP Camera Plugin can connect to a real RTSP stream given a URL/credentials.
- FR-4.2 FFmpeg is invoked to repackage the RTSP stream into a browser-playable format (HLS or WebRTC — decision required, see §8).
- FR-4.3 Frontend can play a live video feed for a connected camera.
- FR-4.4 Stream failures (camera offline, bad credentials) are surfaced as a camera status, not a crash.

### FR-5 — ONVIF & Real-Time Events (Phase 5)
- FR-5.1 ONVIF Camera Plugin can discover ONVIF-compatible devices on the local network.
- FR-5.2 ONVIF plugin can retrieve stream URI/config from a discovered device.
- FR-5.3 Motion/event notifications (where supported by the camera) are captured and stored.
- FR-5.4 Event history is queryable per camera.
- FR-5.5 Redis is introduced only for a specific, named bottleneck (e.g., status pub/sub fan-out) — not speculatively.

### FR-6 — Recording & Notifications (Phase 6)
- FR-6.1 Recording service can start/stop recording a camera's stream to disk.
- FR-6.2 Recordings are associated with a camera and a time range, and are listable/playable.
- FR-6.3 Event-triggered recording: a motion event can start a recording automatically.
- FR-6.4 Basic storage management (retention/cleanup policy, even if simple).
- FR-6.5 User notifications on defined events (in-app at minimum; email/push optional).
- FR-6.6 Camera reconnection is attempted automatically after a disconnect, with backoff.

### FR-7 — AI & Advanced Features (Phase 7, optional/stretch)
- FR-7.1 Optional detection pipeline (OpenCV/YOLO) can process frames from a camera feed.
- FR-7.2 Detections (person/vehicle/animal) are stored as typed events.
- FR-7.3 Event history is searchable/filterable by type, camera, and time range.

### FR-8 — Production Quality (Phase 8)
- FR-8.1 Entire system runs via Docker Compose with a single command.
- FR-8.2 Automated tests exist for core backend logic (auth, camera CRUD, plugin manager).
- FR-8.3 Structured logging and consistent error handling across the backend.
- FR-8.4 API is documented via Swagger/OpenAPI and matches actual behavior.
- FR-8.5 README includes architecture diagram, setup steps, and screenshots/demo.

---

## 2. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Extensibility** | Adding a new camera type must require writing a new plugin only — no changes to core backend code or database schema. |
| **Reliability** | A single camera failing (disconnect, bad stream, crash in a plugin) must not take down the whole backend or other cameras. |
| **Performance** | Status/event updates should reach the frontend within ~1s of occurring (WebSocket, not polling). |
| **Security** | Passwords hashed (bcrypt/argon2), JWTs short-lived with refresh strategy, camera credentials encrypted at rest (not stored plaintext in Postgres). |
| **Testability** | Core business logic (plugin manager, camera CRUD, auth) must be unit-testable without real cameras or a real database (mockable). |
| **Observability** | Every camera plugin logs connect/disconnect/error events in a consistent, structured format. |
| **Portability** | The whole stack (backend, frontend, Postgres, Redis) must run locally via Docker Compose with no manual per-service setup. |
| **Maintainability** | Plugin interface and core API contracts are documented; breaking changes to either require a version bump/changelog entry. |
| **Scalability (soft target)** | Architecture should reasonably support "dozens of cameras for one user," not thousands across many tenants — this is a portfolio project, not a commercial NVR. Say so explicitly in the README to set correct reviewer expectations. |

---

## 3. System Boundaries

### In scope
- Single-tenant use (one user account "owns" a set of cameras) — multi-tenant/org support is out of scope unless time allows later.
- Camera types: Mock, RTSP, ONVIF. Others (proprietary cloud cameras, e.g. Ring/Nest APIs) are out of scope.
- Local network camera discovery/connection. Remote/cloud relay of video is out of scope for MVP.
- Web frontend only. No native mobile app.
- Basic auth (email/password + JWT). No OAuth/SSO/social login for MVP.

### Explicitly out of scope (for now)
- Multi-user permissions/roles beyond a single owner per camera.
- Horizontal scaling / clustering the backend.
- Mobile push notifications (in-app + optional email is enough).
- Commercial-grade video storage (S3/cloud) — local disk is fine for MVP; cloud storage can be a stretch goal.
- Full AI pipeline (Phase 7) is optional and should never block the "MVP is done" milestone.

Keeping this section in the README is useful — it pre-empts the interview question "how would this scale?" by showing you already thought about it and made a deliberate scope call.

---

## 4. Initial Architecture

### 4.1 High-level component diagram (textual)

```
┌─────────────────────┐        REST/WebSocket        ┌──────────────────────────┐
│  Frontend (React)    │ ───────────────────────────▶ │  Backend (NestJS)         │
│  - Dashboard          │ ◀─────────────────────────── │  - Auth Module            │
│  - Live video player  │        JSON / JWT             │  - Camera Module (CRUD)   │
│  - Event history UI   │                               │  - Plugin Manager         │
└─────────────────────┘                               │  - WebSocket Gateway      │
                                                          │  - Recording Module       │
                                                          └───────────┬──────────────┘
                                                                      │
                                        ┌─────────────────────────────┼─────────────────────────────┐
                                        │                              │                             │
                                 ┌──────▼──────┐              ┌────────▼────────┐            ┌───────▼───────┐
                                 │ PostgreSQL   │              │ Redis (Phase 5+) │            │ Plugin Runtime │
                                 │ (Prisma ORM) │              │ pub/sub, cache   │            │ - Mock         │
                                 └──────────────┘              └──────────────────┘            │ - RTSP         │
                                                                                                  │ - ONVIF        │
                                                                                                  └───────┬───────┘
                                                                                                          │
                                                                                                   ┌───────▼───────┐
                                                                                                   │  FFmpeg        │
                                                                                                   │  (stream I/O)  │
                                                                                                   └────────────────┘
```

### 4.2 Backend module boundaries (NestJS)

- **AuthModule** — registration, login, JWT issuance/validation, guards.
- **CameraModule** — CRUD for camera records, delegates connection lifecycle to PluginManager. Owns the database schema for cameras; knows nothing about RTSP/ONVIF specifics.
- **PluginManagerModule** — registers plugins, resolves a camera record's plugin by `type`, exposes a uniform API (`connect`, `disconnect`, `getStatus`, `discover`) to the rest of the app.
- **Plugins** (`mock`, `rtsp`, `onvif`) — each implements `CameraPlugin`. Lives in its own folder/package so a plugin could theoretically be extracted later.
- **EventsModule** — receives status/motion events from plugins, persists them, and pushes them out via WebSocket Gateway.
- **RecordingModule** (Phase 6) — starts/stops FFmpeg recording processes, tracks recording metadata in Postgres.
- **WebSocketGateway** — single gateway broadcasting camera status and event updates to subscribed frontend clients.

This module boundary is the thing to defend in an interview: **CameraModule and PluginManagerModule never import a concrete plugin directly** — only the interface. That's the whole point of the architecture.

### 4.3 Data flow example: "user views live camera feed"

1. Frontend requests camera list (`GET /cameras`) → CameraModule reads Postgres via Prisma.
2. User clicks "view" on an RTSP camera → frontend requests a stream session (`POST /cameras/:id/stream`).
3. CameraModule asks PluginManager to `connect()` using that camera's plugin (`rtsp`).
4. RTSP plugin opens the stream, hands it to FFmpeg, FFmpeg outputs HLS segments (or a WebRTC track — decision needed).
5. Backend returns a stream URL/session id to frontend; frontend's video player consumes it.
6. Status changes (`connecting` → `connected` → `error`) are emitted as events → EventsModule → WebSocketGateway → frontend updates live without polling.

---

## 5. Data Model (initial sketch)

```
User
 - id, email, passwordHash, createdAt

Camera
 - id, ownerId (→ User), name, pluginType ("mock" | "rtsp" | "onvif"),
   connectionConfig (JSON, encrypted sensitive fields), status, lastSeenAt, createdAt, updatedAt

Event
 - id, cameraId (→ Camera), type ("status" | "motion" | "detection"), payload (JSON), createdAt

Recording
 - id, cameraId (→ Camera), startedAt, endedAt, filePath, triggeredBy ("manual" | "event")
```

This is intentionally minimal for the MVP (`User`, `Camera`) and grows into `Event`/`Recording` in later phases — no need to build tables you won't touch until Phase 5+.

---

## 6. Plugin Interface Contract (draft)

```typescript
interface CameraPlugin {
  readonly type: string; // "mock" | "rtsp" | "onvif"

  connect(config: CameraConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<CameraStatus>;

  // Optional — not all plugin types support discovery (e.g. RTSP with a manual URL doesn't need it)
  discover?(): Promise<DiscoveredDevice[]>;

  // Optional — only plugins that can serve video implement this
  getStreamSource?(): Promise<StreamSource>;
}

type CameraStatus = "unknown" | "connecting" | "connected" | "disconnected" | "error";
```

Keeping `discover` and `getStreamSource` optional (rather than forcing every plugin to implement everything) avoids awkward "not implemented" stubs on the Mock plugin and keeps the interface honest about what each camera type can actually do.

---

## 7. Open Decisions (resolve before/at start of Phase 4)

1. **HLS vs. WebRTC for browser video.** HLS is much simpler to implement but has multi-second latency; WebRTC is low-latency but significantly harder (signaling, ICE/STUN). Recommendation: start with HLS for MVP video, note WebRTC as a stretch goal — this is a defensible, explainable tradeoff in an interview.
2. **Where camera credentials are encrypted** — app-level encryption before writing to Postgres, vs. relying on Postgres-level encryption at rest. Recommendation: app-level (e.g., a `CRYPTO_KEY` env var + `crypto` module) since it's simpler to demonstrate and explain.
3. **When Redis actually gets introduced.** Don't add it until Phase 5 hits a concrete need (e.g., WebSocket fan-out across multiple backend instances — which likely won't even exist for a single-instance portfolio deployment). It's fine if Redis ends up unused/cut — that's a legitimate, explainable engineering decision too.
4. **Recording storage location** — local disk under a mounted Docker volume is sufficient for MVP; note cloud storage (S3-compatible) as a documented future improvement rather than building it now.

---

## 8. Suggested Immediate Next Steps

1. Scaffold the monorepo (FR-1) and get `docker-compose up` running Postgres + backend health check.
2. Implement AuthModule end-to-end (register/login/JWT) with tests before touching cameras.
3. Implement CameraModule CRUD against Postgres/Prisma, no plugin system yet — just persistence.
4. Introduce PluginManagerModule + `CameraPlugin` interface + Mock plugin, and only then wire CameraModule to use it instead of hardcoded logic.
5. Add the WebSocket gateway once Mock plugin can produce real status changes to broadcast.

This ordering keeps every milestone independently demoable and testable — which matters both for staying motivated and for having clean, explainable git history.
