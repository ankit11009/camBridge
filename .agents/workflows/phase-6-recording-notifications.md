---
name: phase-6-recording-notifications
description: Add manual and event-triggered recording, storage, reconnection handling, and basic notifications.
---

## Prerequisites
- Phase 5 complete and committed.

## Steps
1. Implement `RecordingsModule`: `POST /cameras/:id/recordings/start`, `POST /cameras/:id/recordings/stop`, `GET /cameras/:id/recordings`. Recordings write to `RECORDINGS_PATH` (from `.env`) and are tracked in the `Recording` table.
2. Wire a motion `Event` (from Phase 5) to automatically trigger a recording (`triggeredBy: EVENT`).
3. Add basic storage management: a retention policy (e.g., delete recordings older than N days) — a simple scheduled job is sufficient, it doesn't need to be sophisticated.
4. Implement reconnection with backoff: if a camera's plugin reports `DISCONNECTED`/`ERROR` unexpectedly, retry `connect()` with increasing delay (e.g., 1s, 5s, 15s, then give up and surface it).
5. Add basic in-app notifications for key events (camera disconnected, recording started/failed) — a simple notification list in the frontend is enough; email/push is optional.

## Acceptance Criteria
- Manual start/stop recording produces a playable video file.
- A simulated motion event on the Mock camera triggers an automatic recording end-to-end.
- Killing a camera's connection mid-session results in automatic reconnection attempts, visible in logs and/or the UI.

## Commit
`feat: add recording, event-triggered capture, and reconnection handling`
