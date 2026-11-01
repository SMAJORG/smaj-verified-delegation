> Current behavior and API limits: [HACKATHON_READINESS.md](HACKATHON_READINESS.md). Search approval, real result links, separate Task History and genuine execution receipts supersede the historical demo instructions below. Existing stored records are preserved.

> Current repair and live/demo status: [LIVE_INTEGRATION_REPAIR.md](LIVE_INTEGRATION_REPAIR.md). The original mock executor remains; a separately approved Jobs submission and Store saved-product queue is now implemented behind server-side switches.

# Incremental HUB knowledge and approved dashboard extension

The Meta planner, SQLite task/delegation storage, approval endpoints, executor, recovery, independent verifier, proof receipts, and hackathon demonstration remain in place. No production writes or payments were added.

## Changes

- Adapted the approved HTML at https://jade-janessa-59.tiiny.site to the existing workspace: lavender palette, rounded task cards, responsive task activity/results columns, readable status badges, and existing PDF/JSON receipt controls. The prototype's simulated JavaScript and third-party scripts were not imported.
- Added a deterministic repository knowledge sync command: `node scripts/sync-hub-knowledge.mjs /path/to/smajpihub`. It reads the original White Paper and published policy section literals, writes a deployable JSON snapshot, and records SHA-256 hashes. It never edits the source documents. Re-run after approved source updates.
- Added lexical retrieval of up to six relevant source sections to the existing Meta routing prompt. Answers expose source IDs and links in standalone and embedded HUB AI. This supports repository-backed platform information, not unrestricted live web search. Sources shown are retrieved evidence; model answer correctness is not independently certified.
- Instructed Meta to answer ordinary informational questions with empty action steps. The standalone catalog approval control is shown only for actionable plans. Informational answers still use normal authenticated task history; task approval is not required.
- Retained all 15 services and the existing launch status distinction. Store, Jobs, and Stream have read-only AI adapters; other services remain planning-only. Corrected the AI-facing Swap description to the White Paper's peer-to-peer exchange concept and described Token as deferred. The HUB's existing marketing catalog uses token-swap wording; answers are instructed to describe source disagreements explicitly.

## API scope

Existing authorized GET adapters remain the supported integrations:

- Store: `/marketplace/products`
- Jobs: `/jobs/jobs?catalog_read=true` (the existing adapter appends the read-only flag)
- Stream: `/stream/creator-content`

Connection consent, authenticated ownership, same-origin checks, HTTPS origin/path allowlists, bounded payloads, and explicit discovery approval remain enforced. Catalog read receipts are SHA-256 evidence records, distinct from independently verified hackathon delegation receipts. Existing PDF and JSON exports remain available for delegation receipts.

Live endpoint probes returned HTTP 200 and the expected products/jobs/videos array shapes. This does not verify production write functionality, listing authenticity, hosted Meta credentials, or deployment of these local changes.

## Validation

`npm test` passes 36 tests, including retrieval, source hashes, informational routing, approval and ownership enforcement, catalog restrictions, recovery, independent verification, and existing demo workflows. Additional build and HUB validation results are recorded in the final implementation report.

The original White Paper, published policies, hackathon requirements, mission, and core execution architecture were not modified.

HUB frontend TypeScript build (`tsc -b`) passed. HUB catalog-read, creator-content and AI bridge regression scripts passed. Browser screenshot checks were attempted with installed Playwright Chromium, but the browser process exited before creating a page in this environment; visual fidelity and mobile device behavior remain unverified. Meta routing was tested with a controlled provider fixture, not a live credentialed Meta request. Local changes have not been deployed.

The interactive CLI demo could not start because `SMAJ_DEMO_ACCESS_TOKEN` is not configured in this environment. Its existing isolated demo workflow regression tests pass; a credentialed interactive demonstration remains an operator check.
