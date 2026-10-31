# SMAJ Verified Delegation

An independent Meta-powered AI agent that turns authorized goals into bounded actions, verifies actual outcomes, and issues evidence-backed proof receipts. It complements SMAJ PI HUB without modifying or shipping inside the existing application.

## Milestone Two

- Live read-only SMAJ Jobs discovery and Meta `muse-spark-1.3` planning
- Signed HttpOnly sessions, actor-isolated tasks, and mandatory idempotency keys
- Explicit human approval before every mock execution
- Real-time server events, persistent task history, and restart-safe run leases
- Stable `better-sqlite3` persistence with WAL and transactional state changes
- Controlled failure recovery, duplicate prevention, independent verification, and SHA-256 proof receipts

Production Jobs submissions and real Pi payments remain disabled by design.

## SMAJ PI HUB integration

SMAJ AI runs independently at `https://ai.smajpihub.com` and signs users in with SMAJ PI HUB single sign-on: PiHub issues a one-time code, SMAJ AI exchanges it server-to-server for a short-lived signed token, and then creates its own HttpOnly session. Pi access tokens, wallet credentials, and Meta API keys are never sent to SMAJ AI or shared between the two applications.

- Connected read-only services: SMAJ Jobs and SMAJ Store, each behind a user-controlled connection. SSO users start with nothing connected.
- Task history, approvals, and proof receipts stay isolated per authenticated PiHub user.
- Real Pi payments and production write operations remain disabled (`SMAJ_REAL_PI_PAYMENTS_ENABLED=false`, `SMAJ_PRODUCTION_WRITES_ENABLED=false`) until separately approved.

## Configure

Copy `.env.example` to `.env.local`. Hackathon Demo Mode needs no API key or access token. Keep `SMAJ_DEMO_AUTH_ENABLED=true` and use a writable `SMAJ_HACKATHON_DB_PATH` separate from `SMAJ_DELEGATION_DB_PATH`.

For regular users, retain the SMAJ PI HUB SSO configuration and a strong `SMAJ_AI_SESSION_SECRET`. Live AI planning requires `META_API_KEY`. Existing access-token sign-in remains available with a random `SMAJ_DEMO_ACCESS_TOKEN` of at least 16 characters. Secret files are excluded from Git.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000` and select **Try Live Demo**. See `DEMO.md` for the judging flow.

Demo visitors receive a unique, restricted workspace with fictional jobs and three sample tasks (awaiting approval, approved, and verified). The random opaque session credential is stored only in an HttpOnly, SameSite=Strict cookie (Secure on HTTPS); only its SHA-256 hash and one-hour expiry are stored server-side. Logout revokes the session and deletes its sample workspace. Expired workspaces are cleaned up when new demos start. Disabling `SMAJ_DEMO_AUTH_ENABLED` also immediately blocks existing hackathon sessions.

All demo catalog reads and planning use local samples, even when production API keys or write switches are configured. Execution records local mock submissions only. Demo routes use a separate SQLite database and per-session ownership checks; no demo identity is mapped to a real account or administrative role. Workspaces are capped at 50 tasks, and at most 1,000 demo sessions may be active. Regular SSO and access-token sessions continue to use the existing production database. Deploy with persistent storage; multiple instances must share compatible SQLite storage or use a single application instance for this backend.

## Validate

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```
