---
name: phase-3-plugin-architecture
description: Introduce the plugin architecture, Mock camera plugin, and live WebSocket status updates.
---

## Prerequisites
- Phase 2 complete and committed.

## Steps
1. Define `CameraPlugin` in `backend/src/plugins/camera-plugin.interface.ts` exactly as specified in `docs/CamBridge_Build_Spec.md` §6.4. Do not add methods beyond what's specified without flagging why.
2. Build `PluginManagerModule` / `PluginManagerService`: resolves a camera's plugin by `pluginType`, exposes `connect`, `disconnect`, `getStatus` uniformly. Use **one plugin instance per camera** (not a shared singleton) so connection state doesn't leak across cameras.
3. Implement `MockCameraPlugin`: simulates status transitions (`CONNECTING` → `CONNECTED`, occasional `ERROR`) on a timer or manual trigger. No real I/O.
4. Rewire `CamerasService` to call `PluginManagerService` for connect/disconnect/status instead of any stub — add `POST /cameras/:id/connect`, `POST /cameras/:id/disconnect`, `GET /cameras/:id/status`.
5. Build `EventsModule` + `EventsGateway` (WebSocket): broadcast `camera:status` events (see `docs/CamBridge_Build_Spec.md` §6.5 for the exact event/payload shapes). Use Socket.IO rooms scoped per camera or per user.
6. Frontend: add a `useCameraSocket` hook that subscribes to status updates and pushes them into the TanStack Query cache directly (no extra fetch needed). `CameraCard`/`CameraStatusBadge` should update live, no page refresh.
7. Unit tests: `PluginManagerService` resolves the correct plugin and calls the right lifecycle methods; `MockCameraPlugin` transitions states as expected.

## Acceptance Criteria
- Creating a Mock camera and clicking "connect" transitions its status live in the dashboard with no manual refresh.
- `CamerasModule`, `AuthModule`, etc. contain zero imports from `plugins/mock`, `plugins/rtsp`, or `plugins/onvif` — only from `camera-plugin.interface.ts`.
- Unit tests for PluginManager + MockCameraPlugin pass.

## Commit
`feat: add plugin architecture with mock camera and realtime status`
