# SMAJ AI — Verified Delegation

SMAJ AI — Verified Delegation is an AI-powered assistant developed by SMAJ Ecosystem for SMAJ PI HUB, using Meta's Model API to connect natural-language requests with practical digital services.

Users can discover products, explore job opportunities, and access entertainment recommendations through one intelligent interface.

Our key innovation is Verified Delegation: users review and approve proposed actions before execution, while the system maintains transparent records and verifiable proof of supported actions.

Developed by SMAJ Ecosystem for SMAJ PI HUB.

**[Try the public SMAJ AI demo](https://smaj-verified-delegation.onrender.com)** · [Screenshots & demonstration](#screenshots--demonstration) · [Judge walkthrough](DEMO.md) · [Official hackathon video](https://youtube.com/shorts/CmbXa1IvJS4)

The public visitor workspace is separate from the reproducible Verified Delegation runner. It supports anonymous AI requests without Pi authentication. The delegation demo reads published SMAJ Jobs listings, but its job-application writes are local mock actions only. On the linked public deployment, production writes and real Pi payments are disabled; the CLI demo does not submit real applications or make payments.

## Official SMAJ ecosystem websites

| Website | Official purpose |
| --- | --- |
| [SMAJ Ecosystem](https://smaj.org) | Parent technology ecosystem |
| [SMAJ PI HUB](https://smajpihub.com) | Pi-powered super app |
| [SMAJ AI](https://smaj-verified-delegation.onrender.com) | Public visitor deployment |
| [GitHub repository](https://github.com/SMAJORG/smaj-verified-delegation) | Source code and project documentation |

## The problem and our approach

Traditional AI assistants provide answers, but users often must complete actions manually across different applications.

SMAJ AI brings AI assistance closer to real-world services by connecting natural-language requests with published SMAJ PI HUB listings.

Our Verified Delegation approach separates recommendations from consequential actions. Users review proposed actions and explicitly approve them before execution.

The hackathon demonstration showcases this approach through a controlled job-application simulation with independent verification and SHA-256 proof receipts.

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

SMAJ AI uses Meta's Model API for conversation, planning, image understanding, and service discovery. Credentials stay on the server.

| Capability | Implementation |
| --- | --- |
| Account model discovery | `GET https://api.meta.ai/v1/models` |
| AI responses | `POST https://api.meta.ai/v1/responses` |
| Preferred default | `muse-spark-1.3`, only when available to the account |
| Model selection | Compatible account models, selected in the composer and preserved across messages and refreshes |
| Image understanding | Image attachments sent to the selected compatible Meta model |
| Voice input | Browser Web Speech recognition, where supported |
| Voice output | Browser speech synthesis, where supported |
| Consequential actions | Exact drafts require separate human approval before execution |

Open the composer’s model menu, choose an available model, and send the next message. Switching models preserves the conversation and pending approvals. Availability is determined by the account catalog; a screenshot is not a promise that the same models will remain available.

## Screenshots & Demonstration

These are genuine browser captures of SMAJ AI, taken on **4 November 2026**. The public workspace captures show live Meta responses and published Store results. The approval walkthrough uses the application’s **existing isolated hackathon simulation**, with fictional Jobs records and local mock submissions. Its receipts verify that simulation; they do not establish external seller contact, employer submissions, or payments.

**[Open the live application](https://smaj-verified-delegation.onrender.com)** · **[Watch the official demonstration](https://youtube.com/shorts/CmbXa1IvJS4)** · [Capture details and reproduction steps](docs/screenshots/README.md)

### 1. Homepage and AI workspace

The public homepage introduces Verified Delegation. Enter the workspace to compose a request, choose a model, and explore SMAJ PI HUB services. The homepage’s illustrative examples are presentation content, not execution evidence.

![SMAJ AI public homepage and Verified Delegation introduction](docs/screenshots/01-public-homepage.png)

![Actual SMAJ AI workspace with the compact composer and service launcher](docs/screenshots/02-ai-workspace.png)

<details>
<summary>View the mobile workspace</summary>

<img src="docs/screenshots/05-mobile-workspace.png" alt="SMAJ AI workspace at a 390-pixel mobile viewport, showing the compact composer and service grid" width="390" />

</details>

### 2. Account-backed Meta model selection

The menu displays models returned by the configured Meta account, their descriptions, and the selected model. This capture shows Muse Spark 1.3 selected; available models can change.

![Genuine Meta model selector populated from the configured account catalog](docs/screenshots/03-meta-model-selector.png)

<details>
<summary>View the model selector inside a conversation</summary>

![Meta model menu in the fixed chat composer](docs/screenshots/09-chat-model-selector.png)

</details>

### 3. Image upload and real AI conversation

A real image file is selected through the attachment input and previewed before sending. The following Results capture shows the public deployment’s actual Meta response describing the uploaded SMAJ logo. Images are used for the current message and are not saved in conversation history.

![Uploaded SMAJ logo preview in the actual message composer](docs/screenshots/07-image-upload-preview.png)

![Actual Meta image description in the SMAJ AI chat and Results interface](docs/screenshots/08-ai-chat-image-response.png)

### 4. Voice and attachment controls

The attachment menu exposes image upload, camera, and microphone options. The Results menu exposes voice playback controls. **Browser support is required:** the capture browser had no speech-recognition API and no installed synthesis voices. These screenshots demonstrate the actual controls; successful dictation and audible playback were not verified in this environment.

![Actual attachment menu with Upload Image, Camera, and Microphone options](docs/screenshots/06-image-voice-attachment-menu.png)

![Actual Results voice menu with Play Voice, Pause, Stop, and Mute controls](docs/screenshots/11-results-voice-controls.png)

### 5. Service discovery and published product results

The launcher distinguishes connected services from planned integrations. The Results page below comes from a real Store search and includes published product images, Pi prices, seller details, and product links. Listed quantities are catalog data, not a seller’s confirmation of availability.

![Expanded SMAJ PI HUB service launcher and connection status legend](docs/screenshots/04-service-discovery.png)

![Actual Store discovery results with published listings and real product details](docs/screenshots/10-store-discovery-results.png)

<details>
<summary>View Results on mobile</summary>

<img src="docs/screenshots/16-mobile-results.png" alt="Actual Store search results and fixed chat composer at a 390-pixel mobile viewport" width="390" />

</details>

### 6. Verified Delegation: plan → human approval → execution

**Isolated simulation:** these captures use the built-in fictional Jobs opportunities and sample planner, not live Meta-generated job recommendations. The user reviews the prepared cover notes, selects actions, and explicitly approves them. Execution remains a separate step.

![Built-in demo plan with exact application drafts, selected actions, and the human approval gate](docs/screenshots/12-delegation-plan-human-approval.png)

![Approved demo contract with a separate Run approved actions button and retry demonstration option](docs/screenshots/13-delegation-approved-execution.png)

### 7. Independent verification and SHA-256 proof

After running the approved sample actions, the workflow records local mock submissions, demonstrates a controlled failure and retry, and independently checks the persisted outcomes. The actual Results activity and exported receipt are shown below. The exported JSON’s SHA-256 digest was independently recomputed and matched the stored proof hash.

![Actual verified demo Results and activity log showing approval, mock execution, recovery, verification, and receipt issuance](docs/screenshots/14-delegation-verified-results.png)

![Application-exported verification certificate with simulation scope, verification checks, and proof hash](docs/screenshots/15-sha256-proof-receipt.png)

Inspect the actual exported [JSON receipt](docs/demo/verified-delegation-receipt.json) or [PDF certificate](docs/demo/verified-delegation-receipt.pdf). A SHA-256 digest makes changes to this proof detectable; it is not a digital signature or independent proof of an external action.

For live seller workflows, missing authorized delivery configuration preserves the approved draft as **“Approved — delivery unavailable.”** No successful seller delivery is represented by the screenshots above.

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
## Future development

SMAJ AI aims to expand Verified Delegation across SMAJ PI HUB services, including commerce, employment, education, and other digital utilities.

Planned improvements include deeper Meta AI tool integration, expanded service connectivity, stronger action verification, and more seamless approval workflows.

Our vision is simple:

Not just AI answers. AI actions you can verify.
