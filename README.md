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

Copy `.env.example` to `.env.local` and provide `META_API_KEY` plus a random `SMAJ_DEMO_ACCESS_TOKEN` of at least 16 characters. Secret files are excluded from Git.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000` and sign in with the configured demo access token. See `DEMO.md` for the scripted judging flow.

## Validate

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```
