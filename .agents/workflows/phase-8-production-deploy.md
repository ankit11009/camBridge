---
name: phase-8-production-deploy
description: Harden the app for production, wire up CI, write the final README, and deploy to a public URL.
---

## Prerequisites
- MVP (phases 1-3) and phase 4 complete at minimum. Phases 5-7 are optional bonus material — do not delay this phase waiting on them.

## Steps
1. Apply the full security checklist from `docs/CamBridge_Build_Spec.md` §6.7: `helmet()`, restricted CORS, global `ValidationPipe`, rate limiting on `/auth/*`, bcrypt password hashing, encrypted `connectionConfig` secrets, no secrets in logs, `.env` gitignored, `npm audit` clean.
2. Add `backend/docker-entrypoint.sh` (already provided) as the backend's `ENTRYPOINT` so `prisma migrate deploy` runs automatically before the server starts on every deploy.
3. Add `docker-compose.prod.yml`: remove dev bind-mounts, add an Nginx (or Caddy) reverse proxy in front of frontend + backend, `restart: always`, `NODE_ENV=production`.
4. Add `.github/workflows/ci.yml` (already provided) — confirm it passes lint/test/build for both `backend` and `frontend` on push/PR to `main`.
5. Provision a small VPS, point a domain at it, copy the repo, create the real `.env` there (never commit it), and run:
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
6. Set up TLS via Certbot/Let's Encrypt (or Caddy's automatic HTTPS).
7. Write the final `README.md` per `docs/CamBridge_Build_Spec.md` §12: summary, architecture diagram, tech stack, setup instructions, screenshots/demo, API docs link, testing instructions, "Design Decisions" section, roadmap.
8. Take screenshots and/or a short demo GIF of the dashboard and live video for the README.

## Acceptance Criteria
- The deployed, public URL works end-to-end: register → add a camera → see live status/video.
- CI is green on `main`.
- README is complete and matches the actual deployed behavior.
- Every item in GEMINI.md's "Definition of done" is checked off.

## Commit
`feat: production hardening, ci, and deployment`
