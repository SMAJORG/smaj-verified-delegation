> Current behavior and API limits: [HACKATHON_READINESS.md](HACKATHON_READINESS.md). Search approval, real result links, separate Task History and genuine execution receipts supersede the historical demo instructions below. Existing stored records are preserved.

# SMAJ AI integration repair — 2026-11-01

The hackathon mission and strategy document are unchanged. The original mock Jobs executor, isolated demo sessions, recovery demonstration, verifier, and PDF/JSON exports remain available. Live operations use a separate persisted action queue, never the mock-submission table.

## Request flow

- Embedded HUB: `frontend/src/pages/private/AiPage.tsx` → authenticated HUB `/ai/tasks` → the backend AI bridge signs a 60-second user identity token → delegation `/api/tasks` authenticates and applies ownership → `MetaServiceRouter` → server-only Meta `/v1/models` and `/v1/responses`. The actual completed response is parsed, saved, and displayed with model/response metadata. No predefined planner fallback exists. The official protocol is documented at https://dev.meta.ai/docs/api-reference/responses/create-response.
- Standalone dashboard: the same `/api/tasks` pipeline uses the existing authenticated session. Both Home and Tasks expose a natural-language composer for all services. The approved dashboard palette, layout classes, cards and responsive rules are retained. The Jobs-specific form is retained inside a clearly labeled simulated-workflow disclosure.
- Meta selects service steps and structured search/budget criteria. Dollar budgets use Store `priceUsdt`; Pi uses `pricePi`. Neither is converted into the other. Cars for sale route to Store; Transport remains planning-only.
- Explicit discovery approval connects the selected available services, reads only allowlisted HTTPS HUB GET APIs, and authorizes sending public listing metadata to Meta. A second actual Meta response analyzes the results and proposes matches/drafts using only retrieved IDs. The receipt records an API snapshot, not proof of a submission or payment. Model errors retain their error codes/messages alongside saved evidence, without a fabricated model answer.

## API and database evidence

- Jobs: `/jobs/jobs?catalog_read=true`, Mongo `jobCollection`. Reads must not call seed initialization. Discovery additionally requires `employerId` and excludes `isDemo` records. The client adapter filters legacy unbacked seeds even before the repaired HUB is deployed. Jobs IDs use the backend slug expected by application APIs. A current expiry is used for each catalog request.
- Store: `/marketplace/products`, Mongo `productCollection`. Existing publication/moderation filters remain. `currency=USD` applies budgets to `priceUsdt`; the existing default budget behavior still uses Pi. The adapter also checks the returned currency-specific price before presenting budget matches, preserves both numeric prices and quantity, and never claims exhaustive inventory coverage from a bounded page.
- Stream: `/stream/creator-content`, Mongo `streamContentCollection`. Discovery uses only public, approved, playback-allowed creator content. Bounded literal search/category filters and description metadata were added. This is published creator metadata, not invented movies, entitlement checks, or an automatic playback integration. Missing storage returns an explicit 503.

## Live delegation contract

A grounded Meta analysis may draft at most three Jobs applications or Store saved-product actions. A real SSO user must review the exact drafts and separately approve selected action IDs plus a hash binding those drafts to the discovery evidence. Expired evidence, other users, changed drafts, demo identities, disconnected services, and unsupported actions fail closed.

Approval atomically writes `live_action_runs` and the approved contract to SQLite. `npm start` now supervises both the Next web process and a worker on the same host, so the existing hosting start command processes persisted approvals. `npm run worker` is also available for development or separately supervised local workers. Both processes must use the SAME persistent volume and SAME `SMAJ_DELEGATION_DB_PATH`; separate ephemeral disks do not share a queue. The worker uses leases, bounded transient retries, persisted per-action evidence/events, and recovery after restart. It verifies backend state before retrying a possibly completed action, avoiding duplicate writes after a lost response.

The HUB's `/ai-delegation/execute` and `/ai-delegation/verify` require a separate short-lived HMAC capability bound to one action, identity, approval, expiry, and operation. No Pi token or browser cookie is forwarded. Jobs use the real candidate profile, CV visibility rules, employer restrictions, and existing unique `(candidateId, jobId)` index in `jobApplicationCollection`. Existing unrelated applications are never relabeled as new delegated submissions. Store uses an idempotent save operation in `favoriteCollection`, rather than the existing interactive toggle endpoint. Neither operation spends funds or creates orders.

Only independent backend lookup evidence matching the owner, contract, service, record, kind, ID and supported status can produce a live verified receipt. Partial/failing runs retain evidence and errors but receive no success receipt. The downloaded JSON includes the proof material; SHA-256 of `JSON.stringify(receipt.proof)` must equal `receipt.proofHash`. Existing mock proof receipts and PDF exports remain separate.

## Required deployment configuration

No secrets were found in the local server environment or local dotenv files. No secret values were printed or added to source code.

Delegation web process and worker:

- `META_API_KEY` (or `MODEL_API_KEY`) and `META_MODEL`, set to a model your account can actually access. The existing documented default is preserved, but it is not evidence of account access.
- `SMAJ_AI_SESSION_SECRET`, `SMAJ_AI_SSO_SECRET`, and `SMAJ_AI_CLIENT_ID` for existing authenticated sessions/bridge. SSO authorization-code login also uses `PIHUB_API_BASE_URL` and `SMAJ_AI_CLIENT_SECRET`.
- `SMAJ_AI_PUBLIC_URL` and/or Render's `RENDER_EXTERNAL_URL` for exact mutation origins.
- `SMAJ_HUB_API_ORIGIN`, `SMAJ_JOBS_API_URL`, `SMAJ_STORE_API_URL`, `SMAJ_STREAM_API_URL` for allowlisted catalog access (public production defaults exist).
- `SMAJ_DELEGATION_DB_PATH` on persistent shared storage for web/worker.
- A NEW `SMAJ_AI_DELEGATION_SECRET` of at least 32 characters, and `SMAJ_PRODUCTION_WRITES_ENABLED=true` only when enabling reviewed live actions.

HUB backend:

- `SMAJ_AI_BACKEND_URL`, matching `SMAJ_AI_SSO_SECRET` and `SMAJ_AI_CLIENT_ID`.
- Matching independent `SMAJ_AI_DELEGATION_SECRET` and `SMAJ_PRODUCTION_WRITES_ENABLED=true` for the limited live action adapter.
- Existing MongoDB and Pi authentication configuration. `SMAJ_REAL_PI_PAYMENTS_ENABLED` does not enable an AI payments integration.

Keep these values server-side, never in `VITE_` or `NEXT_PUBLIC_` variables. The example write switches remain disabled. Existing demo secrets are only for the existing demo; they do not authorize live actions.

## Verification and operational status

Read-only production probes on 2026-11-01 returned 22 Store products and 11 public Stream content records. The raw Jobs API returned six legacy records, but zero passed the employer-backed listing filter. SMAJ AI must report no published employer-backed jobs for this evidence rather than present seed opportunities as real jobs. These counts are point-in-time observations and do not verify seller authenticity or playback entitlements.

Live Meta routing and grounded analysis could not run: neither `META_API_KEY` nor `MODEL_API_KEY` is configured, and `META_MODEL` is unset locally. No live model success or real write success is claimed. The verifier exits nonzero when Meta checks fail and records live writes as not run. It never performs a real application or modifies a saved product merely to test connectivity.

Automated tests exercise controlled provider/database fixtures for routing, query handling, ownership, origin checks, approval binding, mock-mode isolation, queued actions, lost responses, restart recovery, backend evidence mismatches, CV privacy, and success receipts. They do not establish live provider access or production write deployment. Run `npm run verify:live` after configuring credentials; complete an authenticated user-approved Jobs/Store run after both backends and the worker are deployed.

No deployment was performed as part of this repair.

### Completed local checks

- Delegation suite: 43/43 tests passed, including the complete fixture-backed request → Meta route → approved catalog → grounded analysis → exact-draft approval → worker → backend verification → receipt flow.
- HUB backend production TypeScript build and `npm run test:ai` passed. Contract tests use a fixture database and do not establish production write access.
- Delegation Next.js production build and HUB frontend TypeScript/Vite production build passed. The frontend emits existing bundle-size/import warnings.
- Production supervisor smoke test started web and worker together on an isolated temporary database, returned HTTP 200 for `/api/health` and `/`, and shut down cleanly on SIGTERM.
- Chromium launched but exited before creating a page. Browser screenshots and mobile visual behavior remain unverified; the approved reference HTML was retrieved and the established design retained in code.
- `npm run verify:live` intentionally exits nonzero because real Meta credentials are absent. Store and Stream reads succeeded; Jobs contained no eligible employer-backed listings. Real production submissions/saved-product writes were not performed.
