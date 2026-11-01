# Live-only SMAJ AI

The production application no longer offers demonstration authentication, preloaded tasks, fictional listings, simulated execution, mock applications, or manufactured verification histories. The original hackathon mission and strategy document remain unchanged.

## Removed production paths

- Landing-page demo buttons, fictional conversation carousel, fake progress/history panels, and mock workflow artwork.
- Dashboard demo banners, expiry notices, sample-task buttons, mock Jobs forms and simulated receipt exporters.
- Demo access-token login, demo session creation, workspace seeding, sample Store/Jobs APIs, and mock execution routes. Retired endpoints return HTTP 410; old environment flags cannot re-enable them. The HUB bridge also excludes legacy delegation APIs.
- The mock executor is retained only as an isolated test fixture in `tests/support`, outside the production dependency graph.

Authentication now requires the existing SMAJ PI HUB SSO identity or signed Hub bridge token. Legacy demo cookies are rejected. Session signing uses `SMAJ_AI_SESSION_SECRET`, with no demo-token fallback.

## Data preservation

No data-deletion migration, demo-session cleanup, or database purge was run. Existing SQLite files, task records, delegation records, historical receipts, and service settings are retained. Records without recorded Meta provenance are excluded from the live task history, rather than being deleted or presented as genuine model activity. Legacy simulated histories are not exposed by production APIs. Explicit user-requested task deletion remains available for completed tasks.

## Real request and action flow

A request goes through the server-only Meta client, records the received model response, and displays the selected service, model metadata, timestamps, plan and actual service records. Model/API errors are displayed; no sample answer or listing is substituted.

The interface shows Analyzing, Planning, Awaiting Approval, Executing, Verifying and Completed according to actual requests and persisted events. Queued, retrying and failed outcomes remain explicit. Timers do not manufacture completed activity. Read-only answers can complete without a write; they do not receive execution proof receipts.

Jobs, Store and Stream retain their real HTTPS catalog adapters. Jobs excludes seed rows without employer backing. A user separately approves discovery and exact action drafts. Supported writes are real Jobs applications and Store saved products; purchases/payments remain unavailable. A durable worker executes approved contracts and independently reads the backend before recording success. The worker persists execution/verification state before calling each operation, and preserves restart recovery and idempotency.

## Genuine PDF/JSON proof

`GET /api/tasks/:id/receipt?format=pdf|json` requires task ownership, a recorded Meta plan and analysis, completed live execution, matching approval, supported action kinds, matching owner/contract/service/record/backend IDs and statuses, and a valid proof hash. Pending, failed, simulated, incomplete and tampered evidence cannot be exported as a proof receipt. There is no generic client-side certificate generator.

PDF exports wrap long evidence over multiple pages and show non-ASCII characters using explicit Unicode escape notation. JSON preserves the original strings. Receipts describe backend state at the recorded verification timestamp; hashes provide integrity checks, not digital signatures. The embedded HUB bridge relays PDF bytes and authenticated JSON attachments without changing their content.

## Runtime requirements

- Meta: server-only `META_API_KEY` (or `MODEL_API_KEY`) and an accessible `META_MODEL`.
- Identity: `SMAJ_AI_SESSION_SECRET`, matching `SMAJ_AI_SSO_SECRET`, and the existing SSO client configuration. HUB requires `SMAJ_AI_BACKEND_URL`.
- Live actions: matching `SMAJ_AI_DELEGATION_SECRET` and `SMAJ_PRODUCTION_WRITES_ENABLED=true` on both servers. Both web and worker must share persistent `SMAJ_DELEGATION_DB_PATH`; `npm start` supervises both processes.

Missing credentials are errors, never a reason to show sample content. Local code changes do not establish live model access or production write deployment.

## Verification on 2026-11-01

- 44 automated tests passed. The suite covers retired endpoints and legacy cookie rejection, preservation of stored records, real-user ownership, Meta error handling, API reads, immutable approval, restart recovery, actual operation-state transitions, receipt ownership, PDF/JSON bytes, and rejection of mismatched or incomplete evidence. Provider/backend fixtures are used for write tests; these are test-only fixtures, never production demonstration data.
- All three production builds passed: delegation Next.js, HUB backend TypeScript, and HUB frontend TypeScript/Vite. Delegation typecheck and HUB backend AI integration tests also passed. The HUB bridge test verifies PDF bytes and attachment headers are relayed without JSON encoding, and legacy mock routes are excluded.
- Production startup against a temporary database returned HTTP 200 for the landing page, whose HTML contains no demo buttons, fictional conversations, or simulated histories. Retired login/execution endpoints returned HTTP 410. Web/worker startup and SIGTERM shutdown passed.
- Public live API probes returned 22 Store records and 11 Stream creator records. Jobs returned zero eligible employer-backed records. These are catalog-read observations, not certification of listing authenticity or production write access.
- Real Meta routing and grounded analysis remain blocked locally: `META_API_KEY`/`MODEL_API_KEY` and `META_MODEL` are absent. The verifier reports failure and exits nonzero, rather than claiming a generated answer. Real production actions were not performed.
- No deployment, database cleanup, or production data mutation was performed.
