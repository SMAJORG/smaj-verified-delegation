# Hackathon readiness repair — 2026-11-01

The existing SMAJ AI Verified Delegation architecture is retained: Meta planning and analysis, signed Hub identity, per-user service consent, persisted SQLite contracts/queue, bounded execution, restart recovery, independent backend reads and evidence receipts. No business policy, White Paper, mission or payment architecture was changed.

## User flow

- The original AI chat submits once to the existing Meta planner. The current request opens on Tasks without another prompt. Previous requests are on `/history`; opening one retrieves its saved plan and never resubmits it to Meta. The embedded Hub uses `/ai/history` and `/ai?task=...` for the same behavior.
- Search approval is a compact card: **SMAJ AI needs your permission**, the user's request, **Approve & Search** and **Cancel**. Approval connects only the proposed supported services and reads their real APIs. Cancel is persisted and makes no service or model request. Authentication, provider and service errors are displayed.
- After approved reads, the real Meta Responses API analyzes the saved catalog evidence. Match IDs and action targets are accepted only when present in returned backend records. No model response means an explicit system error; there is no predefined model-answer fallback.
- Catalog cards show backend images, prices, descriptions and exact Hub detail links. Store links use `/product/:id`, Jobs use `/services/jobs/job/:slug`, and Stream uses the actual published playback ID. Missing/invalid images are omitted, never fabricated.
- Only current backend-confirmed `sellerVerified=true` produces the Verified Seller badge. The Hub derives this from the seller account's approved verification, seller tier, seller role/activity, complete public Pi profile and block status; product-supplied badges cannot confer verification.
- The existing Pi authentication flow handles protected product links. The interface says **Sign in with Pi to continue.** and retains the exact product destination through the existing `smaj_post_auth_redirect` mechanism.

## Supported actions and boundaries

- Jobs: approved live application submissions using the existing real candidate profile, CV visibility rules, employer restrictions and unique application index. Each reviewed draft is separately selected and explicitly confirmed for submission. That confirmation is persisted, bound into the signed capability and checked by the Hub before execution.
- Store: approved idempotent saved-product actions in the real favorites collection. Purchases, inventory reservations and payments remain in the existing Hub product/checkout/Pi flow, with its separate confirmations. This repair does not grant automatic purchasing or spending.
- Stream: approved discovery of published public creator records plus exact content navigation. No invented movies, playback entitlement claims or unsupported write adapter. Existing movie/TV watchlists require different identities from public creator records and are not treated as interchangeable APIs.
- Other integrations remain unavailable/planning-only. They cannot be executed by a generated plan.

The worker continues after the browser closes, checks for a completed backend action before retrying, preserves evidence across transient failures and expired leases, and issues success receipts only after all approved outcomes are verified. `npm start` continues to supervise web and worker on the same persistent SQLite volume.

## Genuine receipts and removal of fake paths

PDF/JSON export is authenticated and server-side at `/api/tasks/:id/receipt?format=pdf|json`. It requires recorded model provenance, a live verified contract, matching owner/action/backend identities and statuses, explicit binding-action confirmation where required, and a valid proof hash. Pending, failed, simulated or mismatched evidence cannot create an export. The embedded bridge preserves binary PDF bytes and attachment headers. PDF uses wrapped/multipage evidence; JSON preserves original strings.

Production demo login, seeded workspaces, mock API/execution paths, fictional conversation carousels and simulated certificate generators are removed/retired. Original database files and records are retained, with no purge or data-deletion migration. Unprovenanced histories are not presented as live Meta activity. Legacy simulation code exists only in isolated test fixtures outside the production dependency graph.

## API limitations and configuration

Catalog queries are bounded pages, not exhaustive inventory. Dollar budgets use the backend `priceUsdt` reference; Pi prices are preserved separately and are never treated as dollars. This does not promise USD checkout. Listing authenticity and ongoing stock are not certified by a catalog read.

Local live probes found 22 Store records and 11 published Stream records, with zero eligible employer-backed Jobs records. All 22 returned Store records included images. The exact product-detail API returned the same catalog identity. The motorcycle search under the 3,000 USDT-reference budget timed out once, then returned two matching records on retry. Service reads now run independently in parallel with bounded 30-second deadlines, allowing cold starts without serial timeout accumulation. No real purchase, payment or job application was made during verification.

Live Meta tests remain blocked locally: neither `META_API_KEY` nor `MODEL_API_KEY`, nor `META_MODEL`, is configured. No live model success is claimed from fixtures. Required identity/runtime settings remain `SMAJ_AI_SESSION_SECRET`, matching `SMAJ_AI_SSO_SECRET`, `SMAJ_AI_CLIENT_ID`, `SMAJ_AI_CLIENT_SECRET`, `PIHUB_API_BASE_URL`, `SMAJ_AI_PUBLIC_URL`/`RENDER_EXTERNAL_URL`, and the Hub `SMAJ_AI_BACKEND_URL`. Live action execution additionally requires matching independent `SMAJ_AI_DELEGATION_SECRET` and `SMAJ_PRODUCTION_WRITES_ENABLED=true` on both servers. Web and worker must share persistent `SMAJ_DELEGATION_DB_PATH`.

Render is not connected in this session, and no deployment API key or hook is configured locally. Verified commits can be pushed to main, but a direct production deployment or production environment fix cannot be claimed without host access. Public health responses now expose the non-secret `RENDER_GIT_COMMIT`/`GITHUB_SHA` revision when supplied, so a deployed revision can be checked.

## Completed checks

- 48 delegation tests passed, including search cancellation with zero service/model calls, exact links/media, unconfirmed seller badges, immutable approvals, binding-action confirmation, restart recovery and genuine PDF/JSON evidence guards. The final catalog and full-flow checks were rerun after the service-read concurrency change.
- All three production builds passed: delegation Next.js, Hub backend TypeScript, and Hub frontend TypeScript/Vite. Existing frontend bundle/import warnings remain.
- Hub AI bridge, published catalog, live action contract and current seller-evidence tests passed. These use controlled fixtures for production writes and do not certify a live submitted application.
- Production startup smoke checks use an isolated temporary database. No production records were created or deleted by verification.
