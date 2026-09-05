---
name: phase-7-ai-detection
description: Optional stretch phase — add basic AI detection on camera frames. Do not let this block Phase 8.
---

## Prerequisites
- Phase 6 complete and committed.
- Only start this phase if time remains before the resume deadline. Phase 8 (production hardening + deployment) matters more than this one.

## Steps
1. Integrate a lightweight detection pipeline (OpenCV + a pretrained model, or a YOLO variant) that can run against either a recorded clip or a live frame grab.
2. Store detections as `Event` rows with `type: DETECTION` and a payload describing what was detected (label, confidence, bounding box if available).
3. Extend the event history UI to filter by event type (`STATUS` / `MOTION` / `DETECTION`) and search by camera/time range.

## Acceptance Criteria
- At least person-detection works against either a recorded clip or a live Mock/RTSP feed, producing real `DETECTION` events.
- Event history UI can filter to just detection events.

## Commit
`feat: add ai-based detection events`

## Note
If this phase is skipped or left incomplete, that is fine — say so plainly in the README rather than leaving half-finished detection code that can't be explained in an interview.
