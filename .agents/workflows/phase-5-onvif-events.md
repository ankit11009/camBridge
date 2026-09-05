---
name: phase-5-onvif-events
description: Add ONVIF discovery, persist event history, and introduce Redis only if a concrete need appears.
---

## Prerequisites
- Phase 4 complete and committed.

## Steps
1. Implement `OnvifCameraPlugin` (`backend/src/plugins/onvif/onvif-camera.plugin.ts`) using an ONVIF client library: implement `discover()` to find devices on the local network, and reuse the RTSP/FFmpeg pipeline internally once a stream URI is retrieved from the device.
2. Add `GET /cameras/discover?type=onvif` and a frontend "Scan network" action that lists discovered devices and lets the user add one as a camera.
3. Persist `Event` rows (status changes, motion events where the camera/plugin supports it) via `EventsService`; expose `GET /cameras/:id/events` for history.
4. Build a simple event history view per camera in the frontend.
5. **Do not add Redis speculatively.** Only introduce it if a concrete bottleneck appears (e.g., WebSocket fan-out across multiple backend instances). If you add it, document in `README.md` exactly what problem it solves. If you don't, document that decision too — both are legitimate and explainable in an interview.

## Acceptance Criteria
- An ONVIF-compatible camera on the local network (or an ONVIF simulator/test device) can be discovered and added through the UI.
- Event history is queryable and viewable per camera.
- The README's "Design Decisions" section explicitly states whether Redis was used and why.

## Commit
`feat: add onvif discovery and event history`
