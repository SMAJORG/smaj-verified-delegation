> Current behavior and API limits: [HACKATHON_READINESS.md](HACKATHON_READINESS.md). Search approval, real result links, separate Task History and genuine execution receipts supersede the historical demo instructions below. Existing stored records are preserved.

> Current repair and live/demo status: [LIVE_INTEGRATION_REPAIR.md](LIVE_INTEGRATION_REPAIR.md). The original mock executor remains; a separately approved Jobs submission and Store saved-product queue is now implemented behind server-side switches.

# Public catalog integration

Jobs, Store and Stream discovery now use real HUB public endpoints. They do not require Pi tokens or service API credentials. AI session authentication, per-owner connector consent, explicit discovery approval and same-origin POST checks protect the chat workflow. The discovery approval authorizes reading public metadata and sharing the minimal projected fields with Meta. No HUB credentials are forwarded and no private user records are read.

## Flow and evidence

Create a chat task, connect the relevant apps, then select **Approve read-only catalog discovery**. Server routing chooses only the Jobs, Store and Stream adapters from the saved task. Each call rechecks consent; failures and empty catalogs remain distinct. Evidence is saved to the owner-scoped task before requesting a grounded Meta summary. A downloadable SHA-256 receipt records approval time, completion time, source URLs and normalized records. The hash detects changes; it is not a backend signature or evidence of playback rights. Existing approved mock Jobs applications and their receipts remain explicitly simulated.

The isolated hackathon demo cannot access this live discovery endpoint. Catalog results are untrusted model input; authoritative listing records remain visible alongside the model summary, which is generated text and can contain errors.

## Endpoint contracts

- Jobs: GET `/jobs/jobs?catalog_read=true`, `{jobs, pagination}`. Reads the first bounded page. The HUB change prevents development seeding on this path. Deploy it before using a development HUB backend. Existing database sample records cannot be independently authenticated as genuine employer listings.
- Store: GET `/marketplace/products`, `{products}`; HUB filters active, visible, approved products, up to 60.
- Stream: GET `/stream/creator-content`, `{videos}`; published public, moderated, playback-allowed creator metadata, up to 20. This does not enumerate TMDB titles, inspect subscriptions or grant playback/download entitlement. Missing storage now returns 503 in HUB.

Only the configured HTTPS HUB origin and these three paths are permitted; redirects fail, requests time out at 20 seconds, responses are capped at 1 MB, identities/titles are required, and only projected fields are retained. Results are bounded snapshots, not an exhaustive search index.

## Deployment and unavailable authentication

Set `SMAJ_HUB_API_ORIGIN` and all three `SMAJ_*_API_URL` values to the same backend origin. Set `SMAJ_AI_PUBLIC_URL` to the exact external AI origin for approval/consent Origin validation. Provision an independent `SMAJ_AI_SESSION_SECRET`, existing authenticated access configuration, HTTPS and durable `SMAJ_DELEGATION_DB_PATH` storage. Meta needs `META_API_KEY` (or `MODEL_API_KEY`) and an account-supported `META_MODEL`. Do not use example secrets.

The existing AI SSO client expects `/sso/authorize` and `/sso/token`, which are absent from this HUB checkout. SSO is NOT implemented by this change; leave AI SSO client credentials unset. Public catalog reads do not establish a HUB user identity. Session/Pi bearer authentication remains HUB-owned and is not copied to AI.

No populated Meta, SSO, MongoDB, TMDB, Cloudflare or YouTube credentials were available in the current process environment during verification. HUB production MongoDB/session/storage configuration must be supplied by its operator. Stream public creator metadata needs HUB database availability, not a new AI streaming key. TMDB/YouTube/Cloudflare credentials are needed only for their corresponding separate HUB features; those are not enabled here.

Live HTTP verification on 2026-10-31 returned 200 and 6 Jobs, 22 products and 11 creator items. This demonstrates endpoint availability, not listing authenticity, SSO, playback permission or live Meta completion. Deployments may change independently of these commits.
