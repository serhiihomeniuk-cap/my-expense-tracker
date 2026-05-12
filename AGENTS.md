# AI Agent Guidance for Personal Expense Tracker

## Purpose
Full-stack scaffold for a Personal Expense Tracker with React + TypeScript frontend, Express + TypeScript backend, PostgreSQL, and Socket.io. The product spec lives in `README.md`; implementation guidance and the binding rules live in `CLAUDE.md`. Read both before changing anything substantive.

## Layout
- `backend/` — Express + TS server. Entry `src/index.ts`. Routes under `src/routes/` (auth, categories, transactions, budgets). WS + alert logic under `src/services/`. JWT middleware in `src/middleware/auth.ts`. DB schema in `backend/init.sql`. Tests in `src/tests/` (currently a sketch — see "Open gaps" in `CLAUDE.md`).
- `frontend/` — CRA + TS app. Pages in `src/pages/`. Reusable components in `src/components/`. Auth state in `src/contexts/AuthContext.tsx`. OAuth-callback handling in `src/App.tsx`.
- `docker-compose.yml` — Postgres 15, backend, frontend.

## Key facts for agents
- Authentication is SSO only: Google and GitHub. No password authentication.
- Identity is keyed by `provider + provider_user_id`, not email.
- Strict per-user isolation is required for all resources and WebSocket alert delivery.
- Budget threshold alerts must fire once per month at 50%, 80%, and 100%, and only when a current-month budget exists.
- Required tests include SSO login mocks, category creation/validation, transaction creation/validation, authorization, and WebSocket budget alerts.
- Alerts must recompute on WS connect, transaction create/update/delete, and budget changes — and the client must send at least one meaningful message to the server (`subscribe` / `ack`).

## Important instructions
- Read both `README.md` and `CLAUDE.md` before making implementation decisions.
- Do not assume the scaffold is exhaustive — see "Open gaps" in `CLAUDE.md` for known spec violations.
- When a stack or product decision changes, update `README.md`, `CLAUDE.md`, and this file together.
- Document category deletion behavior clearly in `README.md` under "Category Deletion Behavior".
- Document WebSocket message format clearly in `README.md` under "WebSocket Documentation" / "WebSocket Message Format".
- Do not add tests that make real Google or GitHub network calls; use mocks or stubs.
- Tests should run against the real Postgres test database (Docker Compose), not against a mocked DB layer — only OAuth providers should be stubbed.

## What to do next
- Close the open gaps listed in `CLAUDE.md` (alert recompute on transaction mutations, frontend WebSocket client, test suite).
- When adding any backend/WS logic, enforce authorization on every route and socket connection.
- When adding tests, ensure the five mandatory cases from the spec remain covered.

## Suggested follow-up customizations
- Create a dedicated skill for project setup and stack scaffolding once gaps are closed.
- Create a dedicated instruction file for testing conventions and mock OAuth behavior.
