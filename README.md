# CamBridge — Plugin-Based IP Camera Integration & Monitoring Platform

[![CI](https://github.com/ankitkumar09/camBridge/actions/workflows/ci.yml/badge.svg)](https://github.com/ankitkumar09/camBridge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

CamBridge is a modular, plugin-based camera management and video surveillance platform architecturally inspired by [Scrypted](https://www.scrypted.app/). Rather than coupling camera control to proprietary vendor SDKs, CamBridge implements an extensible plugin abstraction layer over heterogeneous IP camera protocols (**Mock**, **RTSP**, and **ONVIF Profile S**). It features hardware-accelerated video transcoding to low-latency HLS, real-time bidirectional status dispatch via WebSockets, automated motion-triggered MP4 recording with retention policies, exponential backoff reconnection handling, and lightweight AI object detection.

---

## Architecture Diagram

```
                              ┌──────────────────────────────────────────────┐
                              │            Web Client (React SPA)            │
                              │  - Video Player (HLS.js)                     │
                              │  - Real-Time Timeline & In-App Notifications │
                              │  - Zustand Auth & TanStack Query Cache       │
                              └───────┬──────────────────────────────▲───────┘
                                      │ REST APIs                    │ WebSockets
                                      │ (HTTP/1.1 Range Requests)    │ (Socket.IO)
                                      ▼                              │
┌────────────────────────────────────────────────────────────────────┴────────────────────────────────┐
│                                    Nginx Reverse Proxy (:80 / :443)                                 │
└─────────────────────────────────────┬───────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CamBridge Core (NestJS 10 API)                                    │
│                                                                                                     │
│   ┌─────────────────────┐   ┌────────────────────────┐   ┌──────────────────────────────────────┐   │
│   │     AuthModule      │   │     CamerasModule      │   │             EventsModule             │   │
│   │  - JWT & Refresh    │   │  - CRUD Management     │   │  - Socket.IO Gateway (:status/:event)│   │
│   │  - Rate Limiting    │   │  - ReconnectionService │   │  - Audit History Persistence         │   │
│   └─────────────────────┘   └───────────┬────────────┘   └──────────────────────────────────────┘   │
│                                         │                                                           │
│   ┌─────────────────────┐   ┌───────────▼────────────┐   ┌──────────────────────────────────────┐   │
│   │  RecordingsModule   │   │    StreamingModule     │   │           DetectionModule            │   │
│   │  - FFmpeg MP4 Mux   │   │  - RTSP -> HLS Transcoder  │  - Pluggable AI Inference Engine     │   │
│   │  - 206 Byte Ranges  │   │  - Segment Lifecycle   │   │  - Person / Vehicle / Animal Detections  │
│   │  - Retention Policy │   │    Manager             │   │  - Bounding Box Geometry             │   │
│   └─────────────────────┘   └───────────┬────────────┘   └──────────────────────────────────────┘   │
│                                         │                                                           │
│ ════════════════════════════════════════╪══════════════════════════════════════════════════════════ │
│                     ARCHITECTURAL PLUGIN BOUNDARY (`CameraPlugin` Interface)                         │
│ ════════════════════════════════════════╪══════════════════════════════════════════════════════════ │
│                                         │                                                           │
│                             ┌───────────▼────────────┐                                              │
│                             │  PluginManagerService  │                                              │
│                             └─────┬──────┬──────┬────┘                                              │
│                                   │      │      │                                                   │
│                 ┌─────────────────┘      │      └─────────────────┐                                 │
│                 ▼                        ▼                        ▼                                 │
│     ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐                      │
│     │   MockCameraPlugin   │ │   RtspCameraPlugin   │ │  OnvifCameraPlugin   │                      │
│     │ - Deterministic Test │ │ - Low-Latency RTSP   │ │ - WS-Discovery UDP   │                      │
│     │   Fixtures & Vectors │ │   Demuxing           │ │ - Profile S SOAP XML │                      │
│     └──────────────────────┘ └──────────────────────┘ └──────────────────────┘                      │
└──────────────────────────────────────────┬──────────────────────────────────────────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             ┌─────────────────────┐               ┌─────────────────────┐
             │    PostgreSQL 16    │               │       Redis 7       │
             │   - Users & Roles   │               │   (Horizontal Pub/  │
             │   - Cameras (AES)   │               │    Sub Clustering)  │
             │   - Events/Recordings               │                     │
             └─────────────────────┘               └─────────────────────┘
```

---

## Tech Stack

| Layer | Technologies | Key Rationale |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Modern, performant UI with instant HMR and minimal bundle footprint |
| **State & Cache** | TanStack Query v5, Zustand | Optimistic cache mutations synchronized live with WebSocket telemetry |
| **Backend Core** | NestJS 10, TypeScript, Express | Enterprise modular DI architecture with strict compile-time types |
| **Database & ORM**| PostgreSQL 16, Prisma ORM | Relational integrity, typed migrations, and zero-downtime schema deployments |
| **Video Engine** | FFmpeg 6+, HLS.js | Universal browser video playback with sub-second HLS segment chunking |
| **Real-Time** | WebSockets (Socket.IO) | Bidirectional status events and camera notifications |
| **Security** | Helmet, bcrypt, AES-256-GCM, `@nestjs/throttler` | Defense-in-depth protection: encrypted connection secrets, rate-limited auth |
| **Testing** | Jest, Supertest (Backend), Vitest, RTL (Frontend) | 100% reproducible test suites with 74 backend unit tests & 43 E2E tests |
| **Infrastructure**| Docker Compose, Nginx, GitHub Actions CI | Declarative local containerization and production deployment |

---

## Quickstart (Local Development)

### 1. Prerequisites
- [Docker](https://www.docker.com/) (version 24+) & Docker Compose
- Node.js 20+ (for local CLI runs outside Docker)

### 2. Configure Environment
```bash
git clone https://github.com/ankitkumar09/camBridge.git
cd camBridge
cp .env.example .env
```
*(All variables in `.env.example` come with secure, ready-to-use local defaults).*

### 3. Launch Full Stack with Docker Compose
```bash
docker compose up --build
```
This boots 4 containers:
1. **PostgreSQL 16**: Port `5432`
2. **Redis 7**: Port `6379`
3. **NestJS Backend**: Port `5004` (auto-runs database migrations before listening)
4. **Vite React Frontend**: Port `5173`

### 4. Open the App
- **Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Backend Health Check**: [http://localhost:5004/health](http://localhost:5004/health)

---

## Production Deployment (Single VPS)

Per §11 of the architecture spec, CamBridge is containerized for seamless, single-command deployment to any Ubuntu VPS (e.g. DigitalOcean, Hetzner, AWS EC2):

### 1. Deploy with Production Compose
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
Production features enabled:
- Host bind-mounts removed; containers run optimized production images.
- **Nginx Reverse Proxy** container handles unified HTTP/1.1, WebSocket upgrades (`/socket.io/`), and media streaming on ports `80` and `443`.
- `NODE_ENV=production` and `restart: always` on all services.
- Automated database migrations run via `docker-entrypoint.sh` prior to backend initialization.

### 2. HTTPS / TLS Termination (Let's Encrypt / Certbot)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-cambridge-domain.com
```

---

## Testing & Verification

CamBridge comes with comprehensive unit and end-to-end test suites across both frontend and backend:

### Backend Unit & E2E Tests
```bash
cd backend
npm test               # Runs 74 unit tests across 12 suites
npm run test:e2e       # Runs 43 end-to-end tests across 7 suites
npm run lint           # Lints with strict TypeScript ESLint
npm run build          # Compiles NestJS application
```

### Frontend Tests
```bash
cd frontend
npm test               # Runs 16 unit tests via Vitest
npm run lint           # Runs TypeScript type check
npm run build          # Compiles production SPA bundle via Vite
```

---

## Key Features & User Capabilities

1. **Heterogeneous Camera Protocol Support**:
   - **Mock Camera**: Generates deterministic test vectors and status changes without requiring physical hardware.
   - **RTSP Camera**: Connects to live IP camera streams (H.264), spawning an isolated FFmpeg transcode pipeline to low-latency HLS.
   - **ONVIF Profile S**: Discovers local network cameras via UDP WS-Discovery (`239.255.255.250:3702`), authenticates with WS-UsernameToken, and retrieves live RTSP URIs.
2. **Resilient Reconnection Engine**:
   - Automatically detects stream drops (`DISCONNECTED`/`ERROR`) and initiates exponential backoff reconnect attempts (1s, 2s, 4s...) with maximum retry caps.
3. **Continuous & Event-Triggered Video Recording**:
   - Manual start/stop controls producing standard browser-playable MP4 clips served via HTTP 206 Partial Content byte ranges for responsive scrubbing.
   - Automated motion-triggered recording window (15s) upon motion event capture.
   - Automated storage retention policy purging clips older than $N$ days.
4. **YOLO Person and Zone Detection**:
   - Start/stop monitoring and select a rectangular zone from the camera image.
   - Detects people with YOLO and processes zone occupancy events.
   - Stores `DETECTION` events and sends dashboard notifications.
5. **Real-time Event Audit Log**:
   - Interactive activity timeline with filter chips (`All`, `Status`, `Motion`, `Detection`) and instant text search.

---

## Design Decisions & Trade-Offs

### 1. Why a Plugin Architecture?
Directly embedding RTSP or ONVIF client libraries in business controllers creates tight coupling: vendor SDK quirks leak into routing, testing requires physical cameras, and adding new protocols (e.g., WebRTC, HomeKit) requires rewriting core services. 

CamBridge enforces a strict architectural boundary: `CamerasModule`, `EventsModule`, and `RecordingsModule` **never import a concrete plugin class directly**. All camera interactions execute against the polymorphic `CameraPlugin` interface:
```typescript
export interface CameraPlugin {
  connect(config: Record<string, unknown>, onStatusChange: (status: CameraStatusValue) => void): Promise<CameraStatusValue>;
  disconnect(): Promise<CameraStatusValue>;
  getStatus(currentStatus: CameraStatusValue): Promise<CameraStatusValue>;
  getStreamSource(): Promise<StreamSource | null>;
}
```
This isolates vendor-specific protocol lifecycles, makes unit testing 100% mockable, and allows hot-swapping camera drivers cleanly.

### 2. HLS vs. WebRTC for Video Streaming
- **HLS (Chosen for MVP & Production Delivery)**: Transcodes RTSP to fragmented H.264/AAC MP4 chunks indexed by `.m3u8` playlists.
  - *Pros*: Universally supported by HTML5 video across all desktop and mobile browsers, trivial caching through standard CDNs and Nginx reverse proxies, zero complex ICE/STUN/TURN NAT traversal infrastructure.
  - *Latency*: Tuned to 1–2 seconds with short segment windows (`hls_time 1`, `hls_list_size 3`), optimal for surveillance monitoring.
- **WebRTC (Evaluated)**: Delivers sub-second latency (<500ms) but requires significant stateful SDP offer/answer signaling, STUN/TURN relay servers for NAT traversal, and high server memory overhead per peer connection.

### 3. Redis Evaluation (§13)
Per §13 of the project build specification, Redis was evaluated for event pub/sub. In single-node deployments, NestJS with Socket.IO's in-memory adapter delivers sub-millisecond status dispatch directly to connected clients without network round-trips or operational Redis clustering overhead. Redis is provisioned in Docker Compose and remains reserved for horizontal multi-instance scaling in clustered environments.

### 4. Defense-in-Depth Security Model
- **Encrypted Secrets at Rest**: Camera credentials (passwords, RTSP URLs containing authentication tokens) are encrypted in PostgreSQL using **AES-256-GCM** with unique initialization vectors (`IV`) and authentication tags (`authTag`). Decryption happens strictly in-memory when a plugin needs to connect.
- **Secret Redaction in Logs**: `RedactionLoggingInterceptor` sanitizes request bodies and headers before outputting to stdout, stripping sensitive keys (`password`, `token`, `connectionConfig`).
- **Rate Limiting**: Authentication endpoints are rate-limited via `@nestjs/throttler` to prevent brute-force attacks.
- **HTTP Security Headers**: Global `helmet()` integration enforces CSP, prevents MIME-sniffing, and protects against clickjacking.

---

## API Reference Summary

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Register new user account | ❌ (Throttled) |
| `POST` | `/auth/login` | Authenticate and obtain JWT tokens | ❌ (Throttled) |
| `POST` | `/auth/refresh` | Exchange refresh token for fresh access token | ❌ (Throttled) |
| `GET` | `/auth/me` | Fetch authenticated user profile | ✅ |
| `GET` | `/cameras` | List user cameras | ✅ |
| `POST` | `/cameras` | Create new camera (Mock, RTSP, ONVIF) | ✅ |
| `GET` | `/cameras/:id` | Get camera details (config decrypted) | ✅ |
| `PATCH` | `/cameras/:id` | Update camera name or connection config | ✅ |
| `DELETE` | `/cameras/:id` | Remove camera and terminate stream | ✅ |
| `POST` | `/cameras/:id/connect` | Connect camera plugin and start transcode | ✅ |
| `POST` | `/cameras/:id/disconnect`| Disconnect camera plugin | ✅ |
| `GET` | `/cameras/:id/status` | Query live plugin status | ✅ |
| `GET` | `/cameras/:id/stream` | Get HLS stream source URL | ✅ |
| `GET` | `/cameras/discover` | Scan subnet for local ONVIF cameras | ✅ |
| `GET` | `/cameras/:id/events` | Query event history with type/search filters | ✅ |
| `POST` | `/cameras/:id/events/trigger` | Trigger simulated event (e.g. MOTION) | ✅ |
| `POST` | `/cameras/:id/detect` | Run on-demand AI detection on live feed | ✅ |
| `POST` | `/cameras/:id/recordings/start` | Start manual recording session | ✅ |
| `POST` | `/cameras/:id/recordings/stop` | Stop active recording and compute file stats | ✅ |
| `GET` | `/cameras/:id/recordings` | List recorded MP4 video clips | ✅ |
| `GET` | `/recordings/:cameraId/:file` | Stream MP4 clip with HTTP 206 byte ranges | ✅ |
| `POST` | `/cameras/:id/recordings/:recId/detect` | Run AI detection on recorded MP4 clip | ✅ |
| `GET` | `/health` | Liveness and PostgreSQL connectivity check | ❌ |

---

## Future Roadmap

- [ ] **WebRTC Media Engine**: Sub-500ms ultra-low-latency streaming option for PTZ camera controls.
- [ ] **Hardware Acceleration**: FFmpeg hardware encoding flags (`h264_nvenc`, `h264_vaapi`, `videotoolbox`) for edge nodes (Raspberry Pi / Jetson).
- [ ] **Multi-Tenant Permissions**: Granular role-based access control (Admin, Operator, Viewer) with per-camera sharing permissions.
- [ ] **Cloud Storage Offloader**: S3 / Cloudflare R2 backup integration for archived video clips.

---

## License
MIT License. Built as a portfolio capstone demonstration of modular distributed video surveillance architectures.

### Local development: API, detection and ONVIF

Run `npm run start:dev` in `backend` and `npm run dev` in `frontend`.
The frontend now proxies API requests, HLS and Socket.IO to `127.0.0.1:5004`,
so login/signup work on the frontend's origin, including LAN access.
Leave `VITE_API_BASE_URL` and `VITE_WS_URL` unset for this setup. If the backend
uses another port, start Vite with `BACKEND_URL=http://127.0.0.1:YOUR_PORT npm run dev`.
Restart Vite after changing its configuration. Explicit cross-origin API overrides
still require the frontend origin in the backend's `CORS_ORIGIN` allowlist.

For actual image detection, install FFmpeg and initialize Python from `backend`:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
```

The backend automatically uses `.venv/bin/python`; `DETECTION_PYTHON` can override
it. Install the dependencies above, then download the YOLO11n weights once:

```sh
.venv/bin/python scripts/setup_detector.py
```

The detector uses [Ultralytics YOLO11](https://docs.ultralytics.com/models/yolo11/)
with COCO person class 0 and a default confidence threshold of 0.5. Set
`DETECTION_MODEL` to an absolute path to compatible detection weights,
`DETECTION_CONFIDENCE` to adjust the threshold, and `DETECTION_DEVICE` to select
`cpu` (default) or an available accelerator. Runtime inference requires local weights.

In **Person detection (YOLO)**, capture a frame, drag a rectangular zone, then
click **Start Detection**. A person's bounding-box bottom-center must lie inside
the zone. Entry generates `PERSON_ENTERED`; occupied zones generate
`PERSON_PRESENT` reminders every ten seconds; two consecutive empty samples
generate `PERSON_EXITED`. Events describe zone occupancy, not individual identities
or tracked people. Stop suppresses pending results. Monitoring requests a sample
every two seconds, skipping ticks while inference is busy. Model loading and CPU
speed affect the actual sampling rate. Settings reset on backend restart.
Manual live/recording analysis checks one frame for people in the selected zone;
it does not scan an entire recording. Python, dependencies and model weights must
also be provisioned in container deployments (the existing Alpine image does not
include the PyTorch runtime).

ONVIF discovery requires cameras reachable on the backend's local network with
UDP multicast port 3702 available. Enable ONVIF on the camera, enter its ONVIF
username/password in Network Discovery before adding it, and connect the camera.
CamBridge negotiates the Media service, profile and RTSP URI with WS-Security
credentials rather than guessing a vendor-specific path. Camera and server clocks
must agree for digest authentication. Explicit RTSP URLs remain supported.
