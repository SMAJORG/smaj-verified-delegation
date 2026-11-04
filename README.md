# SMAJ AI — Verified Delegation

SMAJ AI — Verified Delegation is an AI-powered assistant developed by SMAJ Ecosystem for SMAJ PI HUB, using Meta's Model API to connect natural-language requests with practical digital services.

Users can discover products, explore job opportunities, and access entertainment recommendations through one intelligent interface.

Our key innovation is Verified Delegation: users review and approve proposed actions before execution, while the system maintains transparent records and verifiable proof of supported actions.

Developed by SMAJ Ecosystem for SMAJ PI HUB.

**[Try the public SMAJ AI demo](https://smaj-verified-delegation.onrender.com)** · [Judge walkthrough](DEMO.md) · [Official hackathon video](https://youtube.com/shorts/CmbXa1IvJS4)

The public visitor workspace is separate from the reproducible Verified Delegation runner. It supports anonymous AI requests without Pi authentication. The delegation demo reads published SMAJ Jobs listings, but its job-application writes are local mock actions only. On the linked public deployment, production writes and real Pi payments are disabled; the CLI demo does not submit real applications or make payments.

## Official SMAJ ecosystem websites

| Website | Official purpose |
| --- | --- |
| [SMAJ Ecosystem](https://smaj.org) | Parent technology ecosystem |
| [SMAJ PI HUB](https://smajpihub.com) | Pi-powered super app |
| [SMAJ AI](https://smaj-verified-delegation.onrender.com) | Public visitor deployment |
| [GitHub repository](https://github.com/SMAJORG/smaj-verified-delegation) | Source code and project documentation |

## The problem and our approach

People increasingly ask AI systems to coordinate multi-step tasks, but a useful recommendation should not silently become an external action. A system also needs to distinguish model-generated suggestions from authoritative records and make it possible to review what actually happened.

SMAJ AI plans bounded work from a person's request, grounds discovery in allowlisted published catalog data, and presents proposed actions for explicit approval. The hackathon workflow executes only simulated job applications, verifies persisted records independently, and produces a SHA-256 proof receipt. The receipt is evidence of the recorded simulation, not proof of an external side effect.

## Hackathon judging flow

1. Open **[Try the public SMAJ AI demo](https://smaj-verified-delegation.onrender.com)**. It is an anonymous visitor workspace and does not require Pi sign-in.
2. Ask a text question. In a supported browser, use the attachment menu to upload an image or dictate a message. Browser speech recognition handles dictation; image understanding is sent through the configured Meta Responses model and depends on the deployed model/account.
3. Use the Results page voice menu to play a spoken response. Audio is not played automatically; playback requires a user action.
4. For the complete approval-and-proof walkthrough, follow [DEMO.md](DEMO.md) locally and run `npm run demo`. Review the generated recommendations and draft notes. The runner stops at an explicit approval gate unless deliberately configured for unattended automation.
5. After approval, observe the mock execution, controlled transient failure and idempotent retry, independent verification, event log, and SHA-256 receipt.

The public visitor workspace is not pre-seeded with the CLI runner's sample tasks. Do not interpret image descriptions as verified product matches; catalog results come from the published catalog adapters.

## Verified Delegation workflow

```text
Person's goal and candidate skills
        ↓
Read published SMAJ Jobs listings
        ↓
Meta proposes bounded recommendations and draft cover notes
        ↓
Person reviews and explicitly approves selected drafts
        ↓
Local mock submissions (no production application call)
        ↓
Verifier checks persisted actions and unique idempotency keys
        ↓
Proof receipt with SHA-256 digest
```

In the application workflow, recommendations are bounded to at most three and must refer to IDs from fetched Jobs records. Execution requires explicit approval; rejected or unapproved actions are not executed. The verifier checks the approved job IDs against persisted mock submissions and validates idempotency-key uniqueness before issuing a receipt. The demo runner also injects a transient failure and retries safely. Its receipt describes the verified simulation, not an external job application.

## Architecture

- **Next.js workspace and route handlers** provide the visitor session, chat, task planning, consent checks, approvals, and task updates.
- **Meta client and planners** call the Meta Model API and validate generated response text into application plans.
- **Catalog adapters** retrieve published Jobs, Store, and Stream records through HTTPS host/path allowlists, redirect protection, and bounded response parsing. The hackathon delegation runner uses the read-only published Jobs catalog.
- **SQLite (`better-sqlite3`, WAL)** persists application tasks, delegation events, idempotency records, mock submissions, and receipts. Keep demo and production data separate.
- **Executor and verifier** enforce approval for consequential simulated actions, record outcomes, compare persisted records with approved actions, and create JSON/PDF receipts.

## Meta AI integration

The implemented provider integration is the server-side Meta Model API:

| Purpose | Request |
| --- | --- |
| Account model catalog | `GET https://api.meta.ai/v1/models` |
| Generate a response | `POST https://api.meta.ai/v1/responses` |
| Default model ID | `muse-spark-1.3`, overridable with `META_MODEL` |

The application reads the configured account's model catalog, then sends a prompt, model ID, `max_output_tokens`, and `store: false` to the Responses endpoint. The catalog mismatch is logged but does not strictly reject a model before the Responses request. The default model ID is a code default; availability depends on the configured Meta account.

Image questions use `input_text` and `input_image` content in the Responses request. The server validates images and limits them to 4 MiB; image bytes are not persisted in conversation history. Vision support depends on the configured model and account. Provider failures are reported rather than replaced with invented analysis.

The API key is sent only in a server-side Authorization header using `META_API_KEY` (or legacy `MODEL_API_KEY`). Never put provider credentials in client-side or `NEXT_PUBLIC_` variables.

Meta is asked for JSON as ordinary response text. SMAJ AI parses and validates it; it does **not** configure native JSON Schema structured output such as `response_format`, and there is no Meta tool/function-calling schema or model tool-call dispatcher implemented. Application routing and execution are handled by SMAJ AI after parsing.

Voice dictation uses browser Web Speech recognition and sends its transcript through the existing task workflow. Spoken output uses browser speech synthesis and requires an explicit user action. These features do not call a Meta speech or audio API; browser support and microphone permission vary.

## Screenshots

No application screenshots are included yet. A genuine capture could not be made in the current environment because its installed headless Chromium exits before opening a page. No illustrations or fabricated images are presented as functional screenshots. The public demo and [official demonstration video](https://youtube.com/shorts/CmbXa1IvJS4) are available to view the interface.

## Installation and local setup

**Requirements:** Node.js 24 and npm.

```sh
git clone https://github.com/SMAJORG/smaj-verified-delegation.git
cd smaj-verified-delegation
npm ci
cp .env.example .env.local
```

For new live Meta requests, set server-side credentials and a local demo token in `.env.local`:

```dotenv
META_API_KEY=your_meta_api_key
META_MODEL=exact_model_id_from_your_account_catalog
SMAJ_DEMO_ACCESS_TOKEN=generate_a_random_secret_at_least_16_characters
```

Use an exact model ID available to the configured key from `GET https://api.meta.ai/v1/models`. Do not copy production secrets into a local judging setup. The `.env.example` contains placeholders and safe demo defaults; public visitor access and the local demo do not require production-write credentials or Pi payment configuration.

Start the app:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To run the Verified Delegation walkthrough, leave the app running and open another terminal:

```sh
SMAJ_DEMO_ACCESS_TOKEN=your_local_demo_token npm run demo
```

The app and runner must use the same local `SMAJ_DEMO_ACCESS_TOKEN`. The runner reads the published Jobs catalog and writes only local mock records. Set `DEMO_AUTO_APPROVE=1` only for an unattended run; by default the runner pauses for explicit approval. See [DEMO.md](DEMO.md) for details.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

## Suggested next improvement

Prototype one narrowly scoped Meta function call, `search_public_jobs`, backed by the existing read-only Jobs adapter. First confirm tool calling is supported by the selected account/model and Responses API. Keep the tool allowlisted, bound its inputs and results, display proposed calls, and preserve explicit human approval for any simulated action.
