# SMAJ Verified Delegation

An independent Meta-powered AI agent that turns authorized goals into bounded actions, verifies the actual outcome, and produces evidence-backed proof receipts.

This hackathon repository complements SMAJ PI HUB but does not modify or ship as part of the existing SMAJ PI HUB application.

## Milestone One

- Read-only discovery from the deployed SMAJ Jobs API
- Planning with Meta `muse-spark-1.3`
- Explicit approval before action
- Mock-only job applications with idempotent retries
- Independent verification from the local action store
- Tamper-evident proof receipts and event timeline

No real Pi payments or production job submissions are performed.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Validate

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```
