# SMAJ AI / SMAJ PI HUB integration proposal

Status: preparation and architecture review. SSO, Store access, DNS and production deployment are not activated by this document. The Hub homepage shortcut is a separate change in the Hub repository.

## Independent deployments

Keep `SMAJORG/smajpihub` and `smaj-verified-delegation` independent: separate source, CI, releases, databases, secrets and rollback. Deploy this Next.js application at `https://ai.smajpihub.com`; point only that DNS record to the AI hosting provider, issue TLS, and register its exact callback URL. Do not point the subdomain to the Hub's static GitHub Pages deployment: AI requires a Node server and persistent SQLite storage (or a separately planned database migration).

## Existing authentication reviewed

Reviewed the adjacent `smajpihub-1` source: `backend/src/services/auth.ts`, `backend/src/index.ts`, and `frontend/src/lib/axiosClient.ts`.

- Hub resolves a server session user from MongoDB and rejects blocked users. It also accepts Pi bearer tokens or `X-SMAJ-Access-Token`, looks up the user, rejects revoked tokens, and checks `/v2/me` and token expiry against Pi. Verification is memoized only within one request.
- The web client currently reads the Pi token from localStorage and attaches it to API requests; native clients have a secure-storage fallback. This is an existing exposure surface, not a pattern to copy into AI. Moving the Hub web client to session-only authentication is a separate migration requiring native-client regression testing.
- Hub configures sessions, allowed origins and unsafe-request origin checks. AI is a separate origin; sharing a parent-domain cookie would increase the trust boundary. Do not share session signing keys, Pi tokens, database access or wallet credentials.
- AI currently authenticates with a shared demo secret, deriving its actor ID from that secret. It already isolates task and connector records by owner, but this demo actor is not a Hub user. Do not migrate demo records into a real user's account automatically.

## Proposed SSO flow

1. Clicking the homepage shortcut opens `https://ai.smajpihub.com` with no identity or credentials in the URL.
2. AI `/api/auth/sso/start` generates random state and a PKCE S256 verifier/challenge. Store a short-lived, single-use transaction server-side; bind it to a host-only HttpOnly browser cookie. Redirect to a fixed Hub authorization URL with the registered client ID, exact callback, state and challenge.
3. Hub verifies its existing server session and user status. A signed-in verified user does not sign in again. If a native/Pi Browser bearer-only session cannot be recovered on the Hub authorization origin, use a Hub-owned bridge to establish a Hub session; never forward that token to AI. Verify actual cookie behavior on the deployed Hub/backend origins before enabling this path.
4. Hub issues a cryptographically random authorization code, stores only its hash, and binds it to the immutable user ID, client, exact callback, PKCE challenge and a maximum 60-second expiry. Return the code and state to the registered AI callback. Reject unknown clients, wildcard callbacks and open redirects.
5. AI validates state and browser binding, then exchanges the code over HTTPS with client authentication, callback and PKCE verifier. Hub consumes the code atomically, rejecting replay, expiry, blocked/revoked accounts and mismatches.
6. Return a minimal identity (`sub`, issuer, audience, auth time, session/grant ID) and a narrowly scoped, short-lived opaque grant. Never return Pi access tokens or wallet information. AI resolves or creates an identity keyed by `(issuer, sub)` and issues its own opaque server session.
7. AI uses a host-only `__Host-` cookie with Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain; Lax permits the authorization callback. Rotate on login; enforce idle and absolute expiry. Delete state/code parameters immediately through a redirect. Auth responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Redact credentials and authorization codes from proxy/app logs.
8. Validate Origin and CSRF tokens on mutations. Logout destroys the local session. Hub revocation/account blocking must invalidate AI grants, through an authenticated revocation event plus online introspection before each protected service call. Fail closed on failed introspection. Schedule local session invalidation as well; define and test the revocation latency before release.

Authentication is distinct from permission to read a service. Existing Hub verification status must be checked server-side using an agreed eligibility policy; a client-supplied `verified` flag is never sufficient.

## Required API changes (proposed, not existing endpoints)

| Application | Endpoint | Behavior |
| --- | --- | --- |
| Hub | `GET /ai/oauth/authorize` | Existing Hub session required; validate client/callback/PKCE and issue a one-use code. |
| Hub | `POST /ai/oauth/token` | Authenticated backchannel code exchange; no browser CORS access. |
| Hub | `POST /ai/oauth/introspect` | AI client authentication; verify user, grant expiry/revocation and scopes. |
| Hub | `POST /ai/oauth/revoke` | Revoke a grant and notify AI; never revoke unrelated user sessions implicitly. |
| Hub | `GET /ai/v1/jobs`, `GET /ai/v1/store/products` | Scoped read-only gateway over existing catalog handlers; bounded pagination and allowlisted public fields. No private profile, orders or seller records. |
| AI | `GET /api/auth/sso/start`, `GET /api/auth/sso/callback` | State/PKCE transaction and server-side exchange. |
| AI | `DELETE /api/auth/session` | CSRF-protected local logout and server-session deletion. |
| AI | `GET /api/connections`, `PATCH /api/connections` | List/grant/revoke per-user Jobs/Store read permissions; require CSRF protection and audit consent changes. |
| AI | authenticated revocation receiver | Verify sender signature, timestamp and event ID; reject replays and revoke affected sessions/grants. |

The reviewed Store catalog route is `GET /marketplace/products` with a `{ products }` response, filtering active, visible, approved listings and limiting results to 60. Reuse its public projection and verify the schema with adapter contract tests before declaring Store available. Jobs already uses the public `/jobs/jobs` response. Public catalog reads may remain credential-free, but AI still enforces the user's opt-in before fetching or sending data to Meta. Do not send AI client credentials to existing public routes.

Backchannel credentials and grants are server-only, audience-bound, rotatable and unrelated to Pi secrets. Validate configured HTTPS origins and fixed paths, disable redirects, set timeouts, cap body size/page size, validate response schemas and reject malformed data. Never accept arbitrary service URLs from users or model output. Limit outbound traffic to approved Hub and Meta hosts. Rate-limit authentication, exchange and catalog requests.

## Connectors, routing and ownership

- Define a server registry for `jobs` (`jobs:read`) and `store` (`store:read`) with fixed adapters, input/output schemas and explicit availability. New users start disconnected. Consent clearly describes reading catalog data and sending the necessary data to Meta. Record user, scope, consent version and timestamps; never model-grant permission.
- Check active user session, grant, availability and current consent before planning and again immediately before every adapter call. Recheck after approval or retries; disconnect cancels queued service work and prevents new calls. Model output must name a registry service and an allowlisted read operation. Unsupported/disconnected steps return unavailable and cause no network request.
- Persist immutable Hub identity mapping. Use the authenticated AI actor ID for task history, approvals, receipts, connector grants and events. Every lookup/update, including SSE and receipt downloads, must include owner ID. Never trust a body/query `userId` or grant access from a model-supplied ID.
- Migrate existing database schema deliberately. Keep demo ownership isolated. Encrypt grants at rest and restrict DB/backups to the application account. Do not put secrets in receipt payloads or Meta prompts. Store only necessary personal data; provide retention/deletion rules.
- Keep a server-enforced read-only capability allowlist. No production application submissions, product/order mutations, payments, wallet access or signing adapters. Human approval within the demo does not enable production writes. Enabling any write requires a separate review and explicit approval.

## Environment contract (new names are proposed)

| Deployment | Variable | Purpose |
| --- | --- | --- |
| AI | `SMAJ_AI_ORIGIN=https://ai.smajpihub.com` | Canonical origin; never derive security-sensitive URLs from forwarded Host. |
| AI | `SMAJ_HUB_ISSUER`, `SMAJ_HUB_API_ORIGIN` | Fixed HTTPS authorization issuer and backend API origin. |
| AI | `SMAJ_SSO_CLIENT_ID`, `SMAJ_SSO_CLIENT_SECRET` | Registered AI client and server-only exchange credential. |
| AI | `SMAJ_SSO_REDIRECT_URI=https://ai.smajpihub.com/api/auth/sso/callback` | Exact registered callback. |
| AI | `SMAJ_SESSION_SECRET`, `SMAJ_GRANT_ENCRYPTION_KEY` | Independent random secrets for session protection and stored grants. |
| AI | `META_API_KEY` | Existing server-only Meta key; never use a `NEXT_PUBLIC_` prefix. |
| AI | `SMAJ_DELEGATION_DB_PATH` | Existing persistent database path on durable storage. |
| AI | `SMAJ_JOBS_API_URL` | Existing server-configured public Jobs endpoint; validate origin/path. |
| Hub | `SMAJ_AI_ORIGIN`, `SMAJ_AI_CLIENT_ID`, `SMAJ_AI_REDIRECT_URI` | Exact client allowlist; no wildcard origins/callbacks. |
| Hub | `SMAJ_AI_CLIENT_SECRET_HASH` | Hash of the registered AI client secret, with rotation support. |
| Both | `SMAJ_REVOCATION_SECRET` | Server-only authenticated revocation channel, separate from Pi/session secrets. |

Never commit populated secrets. The existing demo access variable must not silently become a production authentication fallback. Variable declarations alone do not implement SSO or secure a deployment; these names become active only with the corresponding implementation and validation.

## Delivery sequence and release gates

1. Ship the isolated Hub homepage shortcut. Keep its existing size, position and responsive visibility, preserve Messages navigation and the live-activity inbox on other pages. Reuse the AI workspace's current Pi mark. Test link semantics, mobile placement and desktop visibility, then commit and push only the relevant files.
2. Confirm Hub production session/cookie domains, user verification policy, issuer, callback registration and AI hosting. Provision DNS/TLS and independent secret storage. Do not advertise SSO as live before these are tested.
3. Implement Hub authorization, atomic one-use code exchange, introspection and revocation; implement AI SSO/session storage and identity migration. Test state/PKCE mismatch, replay/races, expiry, blocked accounts, callback tampering, CSRF and logout/revocation.
4. Implement per-user consent and Jobs/Store read adapters; test redirects, oversized/malformed responses, timeouts, pagination, unavailable services, disconnection during execution and model attempts to select an unsupported action.
5. Test two distinct Hub users for task/approval/receipt/event isolation, including guessed IDs. Run mobile Pi Browser, native bridge, desktop browser and cross-origin session tests. Inspect browser storage, URLs, logs and built assets for secret leakage.
6. Deploy AI independently with a read-only allowlist. Verify health, DNS/TLS, SSO, opt-in permissions, Meta routing and revocation. Roll back either application independently. Review writes/payments only in a separate approved change.
