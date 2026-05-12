# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Personal Expense Tracker.** Full-stack scaffold is in place:

- `backend/` — Node.js + Express + TypeScript, Passport (Google + GitHub), JWT auth, Socket.io, raw `pg` against Postgres, Jest + Supertest.
- `frontend/` — React 18 + TypeScript (CRA), React Router, Tailwind CSS, axios, `socket.io-client`, lucide-react, date-fns.
- `docker-compose.yml` — Postgres 15, backend, frontend.
- `backend/init.sql` — schema for `users`, `categories`, `transactions`, `budgets`, `budget_alerts` (with the per-month-per-threshold uniqueness needed for "fire once per threshold per month").

The backend's HTTP CRUD, OAuth strategies, and per-user authorization are real (not stubs). The known gaps are listed under "Open gaps" below — they are spec violations that future work must address before this is shippable.

## Commands

All commands assume the working directory is the relevant subproject (`backend/` or `frontend/`).

**Backend** (`cd backend`):
- `npm install` — install dependencies.
- `npm run dev` — start dev server on port 3001 (ts-node-dev, watches src/).
- `npm run build` — TypeScript compile to `dist/`.
- `npm start` — run compiled server.
- `npm test` — Jest. Requires Postgres running and `JWT_SECRET` set; see `backend/.env.example`.
- `npm run lint` / `npm run lint:fix` — eslint.

**Frontend** (`cd frontend`):
- `npm install` — install dependencies.
- `npm start` — CRA dev server on port 3000.
- `npm run build` — production build.
- `npm test` — CRA Jest (note: no React tests written yet).

**Full stack** (repo root):
- `docker-compose up -d postgres` — Postgres only (recommended for local dev).
- `docker-compose up` — all three services.

**Run a single backend test:** `cd backend && npx jest -t "<test name substring>"`.

## Binding product rules

These come from `README.md` and constrain every feature. They are easy to violate by accident, so re-check them when implementing or reviewing related code:

- **SSO only** (Google + GitHub). No password auth. Identity key is `provider + provider_user_id`, **not email** — GitHub may omit email depending on user settings. Same human signing in via both providers = two separate accounts for MVP (no linking).
- **Strict per-user isolation.** Every category, transaction, budget, and WebSocket alert must be scoped to the authenticated user. Authorization must be enforced on HTTP routes *and* on WebSocket connections / alert delivery. There is an explicit acceptance test for cross-user access prevention.
- **Budget threshold alerts fire once per threshold per month.** Thresholds are 50% / 80% / 100% of the current calendar month's budget. Editing or deleting transactions after crossing must not re-fire an already-fired threshold for that month. If no budget is set for the current month, **no alerts at all** — not even zero-valued ones.
- **Alerts recompute on:** WS connection open, transaction create/update/delete, any change affecting the current month's budget status. The client must also send at least one meaningful message to the server (`subscribe` or `ack`) — pure server-push is insufficient per the spec.
- **Category names are unique per user.** Enforced in `backend/init.sql` via `UNIQUE(user_id, name)`.
- **Transaction validation:** `amount > 0`, non-empty `title`, valid `transaction_date`. Single currency (USD) — must be shown explicitly in the UI.
- **Budget UI states are not interchangeable.** "No budget set" must render as a distinct empty state, never as "0" or "0%".
- **Tests must not make real Google/GitHub network calls.** SSO tests use mocks or stubs.

## Decisions made

These were locked in by `README.md` and existing code; do not relitigate without a reason.

- **Stack:** React 18 + TS (frontend), Node + Express + TS (backend), PostgreSQL, Socket.io, Tailwind, Passport.js, Jest + Supertest, Docker Compose.
- **Category deletion:** Option B — delete reassigns the category's transactions to an auto-created `Uncategorized` category (`backend/src/routes/categories.ts`).
- **WebSocket message format:** documented in `README.md` under "WebSocket Documentation". Server → client: `budget_alert`. Client → server: `subscribe`, `ack`. JWT passed in `auth.token` (preferred) or query string on connection.
- **Containerization:** Docker Compose with Postgres + backend + frontend (`docker-compose.yml`).

## Open gaps (spec violations to fix)

When you touch related code, fix these:

- **Alerts don't recompute on transaction mutations.** `backend/src/routes/transactions.ts` POST/PUT/DELETE never call `checkBudgetAlerts` or push via Socket.io. Only `routes/budgets.ts` POST does.
- **`sendBudgetAlert` was never wired up** (`backend/src/services/websocket.ts`). Captures `io` from a circular require; should be passed in by `setupWebSocket` and reused from the routes.
- **Frontend has no WebSocket client.** `socket.io-client` is in `package.json` but no code uses it. Violates the spec rule "the client must send at least one meaningful message to the server."
- **Budget alerts have no UI.** No banner/toast component exists.
- **Add-transaction form is a stub.** `frontend/src/pages/Transactions.tsx` shows "Transaction form will be implemented here".
- **Test suite is a sketch.** `backend/src/tests/api.test.ts` uses a hardcoded `'mock-jwt-token'` that won't verify, has no DB seeding, no SSO mock, no cross-user authz test, no WS threshold tests. `jest.config.js` references `src/tests/setup.ts` which does not exist.

## Required test coverage

The spec mandates tests for: SSO login (mocked provider), category creation + validation, transaction creation + validation, cross-user authorization, and WebSocket alerts at 50% / 80% / 100%. Treat these as non-negotiable — adding new features should not regress this set. As of the most recent assessment, none of these are actually exercised by `api.test.ts`.

## When you make a stack/spec change

If a decision in this file changes (stack swap, deletion-strategy flip, new alert thresholds), update `README.md` and `AGENTS.md` in the same change so all three stay in sync.
