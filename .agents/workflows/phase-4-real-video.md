---
name: phase-4-real-video
description: Add a real RTSP camera plugin, FFmpeg-based transcoding to HLS, and live video playback in the browser.
---

## Prerequisites
- Phase 3 complete and committed.
- FFmpeg available in the backend's runtime (already added to `backend/Dockerfile` via `apk add ffmpeg`).

## Steps
1. Implement `RtspCameraPlugin` (`backend/src/plugins/rtsp/rtsp-camera.plugin.ts`): reads an RTSP URL + optional credentials from `connectionConfig`, implements `connect`/`disconnect`/`getStatus`/`getStreamSource`.
2. Implement `FfmpegService` (`backend/src/streaming/ffmpeg.service.ts`): spawns FFmpeg to transcode the RTSP source into HLS segments (`.m3u8` + `.ts`) in a per-camera output directory. Track the child process PID so it can be killed cleanly on `disconnect()`. Starting flags are in `docs/CamBridge_Build_Spec.md` §6.6 — tune as needed but keep `-f hls` output.
3. Serve the HLS output (static file serving from the backend, or a dedicated `/streams/:cameraId/*` route).
4. Wire `POST /cameras/:id/connect` so that RTSP-type cameras return a stream session (`StreamSource`) once connected.
5. Frontend: build `LiveVideoPlayer` using HLS.js (fall back to native `<video>` where the browser supports HLS natively, e.g. Safari), pointed at the stream URL returned by the backend.
6. Handle failure paths explicitly: bad credentials, camera offline, or FFmpeg crash must set camera status to `ERROR`, not crash the backend process.

## Acceptance Criteria
- A real RTSP camera (or a public test RTSP stream) can be added through the UI and its live video plays back in the dashboard.
- Disconnecting a camera actually kills its FFmpeg process (verify via `ps`/`docker top` — no orphaned processes).
- A deliberately bad RTSP URL results in a visible `ERROR` status, not a crash.

## Commit
`feat: add rtsp streaming with ffmpeg and live video playback`
