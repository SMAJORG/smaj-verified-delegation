# SMAJ AI — Verified Delegation

SMAJ AI uses Meta models to plan bounded work across SMAJ PI HUB services. People review proposed actions before approval; the Verified Delegation demo records only simulated job applications, checks the persisted outcomes, and issues a hash-backed receipt.

**Live demo:** [ai.smajpihub.com](https://ai.smajpihub.com) · **Demo instructions:** [DEMO.md](DEMO.md)

> **Demo boundary:** The public AI workspace and the Verified Delegation walkthrough use live Meta planning when configured. The delegation walkthrough reads published Jobs listings but writes only local mock submissions. It does not submit real job applications or make Pi payments.

## Hackathon judging flow

1. Open the [live demo](https://ai.smajpihub.com) and choose **Try Live Demo** to enter an isolated public workspace without Pi sign-in.
2. To see the Verified Delegation proof flow locally, follow [DEMO.md](DEMO.md) to start the app and run `npm run demo`. This requires Meta credentials, a supported model ID, and access to the published Jobs endpoint.
3. Review the generated recommendations and drafts. The script pauses at a human-approval gate; press Enter only when ready to approve the selected **mock** actions.
4. The runner injects one transient failure, retries idempotently, and checks that every selected mock action was persisted exactly once.
5. Inspect the event log and final SHA-256 proof digest. The receipt records the approval, recovery, verification checks, source, and that production writes and Pi payments were disabled.

The public workspace is useful for trying general AI requests and supported read-only catalog searches. It is separate from the CLI delegation demonstration; do not assume public workspace history is seeded with delegation examples.

## Verified Delegation workflow

```text
Goal + candidate skills
        ↓
Read published SMAJ Jobs listings
        ↓
Meta produces bounded job recommendations and draft cover notes
        ↓
Person reviews and explicitly approves selected drafts
        ↓
Local mock submissions (no production application call)
        ↓
Independent check of persisted actions and unique idempotency keys
        ↓
Proof receipt + SHA-256 digest
```

The plan is limited to at most three recommendations and to IDs from the fetched Jobs data. Execution requires explicit approval and uses idempotency keys to prevent duplicate mock submissions. The verifier compares selected job IDs with persisted submissions and checks key uniqueness before issuing the receipt. A controlled retry is available in the demo; interrupted runs use a short lease and can safely resume. The receipt is evidence of this simulated workflow, not proof of an external job application.

## Meta integration currently implemented

Only the server-side Meta Model API is used:

| Purpose | Implemented request |
| --- | --- |
| Account model catalog | `GET https://api.meta.ai/v1/models` |
| Generate a response | `POST https://api.meta.ai/v1/responses` |
| Default model ID | `muse-spark-1.3` (overridable with `META_MODEL`) |

Each generation first reads the model catalog, then sends the prompt, selected model, `max_output_tokens`, and `store: false` to the Responses endpoint. `META_API_KEY` (or the legacy `MODEL_API_KEY`) is sent only in the server-side Authorization header. The catalog is used to log a mismatch warning; this code does not strictly reject a model before the Responses request. The provider may reject an unsupported ID. The default model ID is a code default, not a claim that a particular account or deployment has been verified.

Meta is asked to return JSON as ordinary response text. The application parses that text and validates/normalizes it; it does **not** send a native JSON Schema/structured-output setting such as `response_format`. The planner expects `{ summary, recommendations: [{ jobId, score, rationale, coverNote }] }`; the service router expects `{ summary, services, steps, warnings }`. There is no Meta tool/function-calling schema or model tool-call dispatch implemented. Routing and execution are handled by SMAJ AI after parsing the model's text.

## Architecture

- **Next.js app and route handlers** provide the browser workspace, sessions, task planning, approvals, and task events.
- **Meta client and planners** call the two Meta endpoints above and validate generated text into application plans.
- **SMAJ PI HUB published Jobs endpoint** is read-only for the Verified Delegation planner; the endpoint is configured by `SMAJ_JOBS_API_URL`.
- **SQLite (`better-sqlite3`, WAL)** persists delegations, events, idempotency records, mock submissions, and receipts. Keep production and hackathon/demo databases separate.
- **Verifier and receipt exporter** check persisted results and expose the receipt as JSON or PDF in the app. A receipt hash is a tamper-evident digest of the recorded receipt; it does not attest to an external side effect.

Production Jobs submissions and real Pi payments remain disabled by default. See [INTEGRATION.md](INTEGRATION.md) for broader integration status and security boundaries.

## Screenshots

UI screenshots are not currently committed. The repository's existing [service atlas](public/assets/smaj-service-atlas.png) is an illustration, not a screenshot, so it is not presented as an app capture. Use the [live demo](https://ai.smajpihub.com) for the current visual reference.

## Setup

Requirements: Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
```

Set these server-side values in `.env.local` for new live Meta requests:

```dotenv
META_API_KEY=your_meta_api_key
META_MODEL=exact_model_id_from_your_account_catalog
SMAJ_DEMO_ACCESS_TOKEN=generate_a_random_secret_at_least_16_characters
```

Use an exact model ID available to the configured key from `GET https://api.meta.ai/v1/models`. Keep `.env.local` private and never use a `NEXT_PUBLIC_` prefix for credentials. Do not copy real production secrets into a local judging setup. The `.env.example` contains placeholders and safe demo defaults; SSO and production-write credentials are not needed for the public workspace or the local demo script unless those capabilities are explicitly enabled.

Start the app:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To run the end-to-end delegation demo, keep the app running and, in another terminal, run:

```sh
npm run demo
```

The script uses `SMAJ_DEMO_ACCESS_TOKEN` for its local session. Set `DEMO_AUTO_APPROVE=1` only for an unattended run; otherwise it pauses for explicit approval. It reads the live published Jobs catalog and uses Meta for planning, while mock records are written to the configured local SQLite database. See [DEMO.md](DEMO.md) for the full script configuration and limitations.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

## Suggested next improvement

Prototype one narrowly scoped Meta function call—`search_public_jobs`—backed by the existing read-only Jobs adapter. First confirm tool calling is supported by the selected account/model and Responses API. Keep the tool allowlisted, cap its inputs/results, show the proposed call to the person, and retain the existing explicit approval gate for any simulated action.
