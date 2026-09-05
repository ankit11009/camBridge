---
name: phase-2-auth-camera-crud
description: Implement authentication and camera CRUD, backend and frontend, with no camera plugins yet.
---

## Prerequisites
- Phase 1 complete and committed.

## Steps
1. Implement `UsersModule`: user persistence, password hashing with bcrypt (cost factor 12).
2. Implement `AuthModule`:
   - `POST /auth/register` — email + password → user + access/refresh tokens.
   - `POST /auth/login` — validates credentials → access/refresh tokens.
   - `POST /auth/refresh` — validates refresh token → new access token.
   - `JwtAuthGuard` for protected routes.
3. Add a global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true, transform: true`).
4. Implement `CamerasModule` CRUD against Postgres via Prisma — **pure persistence only, no plugin system yet**:
   - `POST /cameras`, `GET /cameras`, `GET /cameras/:id`, `PATCH /cameras/:id`, `DELETE /cameras/:id`.
   - All routes protected by `JwtAuthGuard`.
5. Frontend: build `LoginPage`, `RegisterPage`, and a `DashboardPage` that lists the current user's cameras (name + status field, even if status never changes yet).
6. Frontend: `ProtectedRoute` wrapper that redirects unauthenticated users to `/login`.
7. Write e2e tests (Supertest): register → login → create camera → list cameras; confirm protected routes reject missing/invalid tokens.

## Acceptance Criteria
- A user can register, log in, and create/list/update/delete a camera entirely through the UI.
- Protected routes return 401 without a valid token.
- e2e tests for the above pass in CI or locally via `npm run test`.

## Commit
`feat: add authentication and camera CRUD`
