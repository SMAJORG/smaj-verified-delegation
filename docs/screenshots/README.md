# Screenshot capture notes

These PNGs are genuine captures of the running SMAJ AI application, taken on **4 November 2026** with Firefox and Playwright at **2× device scale**. Screens were captured through normal application interaction. Some images use native element or viewport cropping to keep controls readable; no UI, model list, AI answer, delivery status, or receipt was composited or replaced.

The main gallery is in the [project README](../../README.md#screenshots--demonstration). Click an image there to inspect its full resolution.

## Capture sources

| Files | Source | What was actually demonstrated |
| --- | --- | --- |
| [01](01-public-homepage.png) | [Public deployment](https://smaj-verified-delegation.onrender.com) | Real landing page. Its own illustrative examples are marketing content, not proof of completed actions. |
| [02](02-ai-workspace.png), [04](04-service-discovery.png), [05](05-mobile-workspace.png) | Public deployment | Actual workspace, expanded service launcher, connection/planned statuses, and a 390 CSS-pixel mobile viewport. |
| [03](03-meta-model-selector.png), [09](09-chat-model-selector.png) | Public deployment | Real account model catalog and selected-model checkmark in home and chat composers. |
| [06](06-image-voice-attachment-menu.png), [07](07-image-upload-preview.png), [08](08-ai-chat-image-response.png) | Public deployment | Attachment controls, real upload of the repository’s SMAJ logo, and the deployed Meta model’s actual image description. |
| [10](10-store-discovery-results.png), [16](16-mobile-results.png) | Public deployment | Actual Meta-assisted Store discovery and published product records, including images, prices, sellers, and source links. The product carousel is scrolled using normal browser interaction. |
| [11](11-results-voice-controls.png) | Public deployment | The actual Results voice menu. This browser exposed speech synthesis but had zero installed voices; speech recognition was absent. No successful transcription or audible playback is claimed. |
| [12](12-delegation-plan-human-approval.png), [13](13-delegation-approved-execution.png), [14](14-delegation-verified-results.png) | Unmodified local app, isolated built-in sample mode | Review of fictional Jobs drafts, explicit approval, actual local mock execution, controlled retry, independent verification, and the application’s activity log. |
| [15](15-sha256-proof-receipt.png) | Firefox’s PDF viewer | The actual PDF downloaded through the application’s receipt button, opened without changing its contents. |

## Live Meta and discovery captures

1. Open the public deployment and choose **Try Live Demo**.
2. Open the composer’s model menu. At capture time, the configured account returned `muse-wonder-1.0`, `muse-spark-1.3-contributor`, `muse-spark-1.3`, `muse-spark-1.2-contributor`, `muse-spark-1.2`, and `muse-spark-1.1`. These were actual API results, not inserted options; future availability may differ.
3. Select **Upload Image** and attach [`public/image.png`](../../public/image.png). Ask: “Describe this uploaded SMAJ logo briefly.” The captured response came from the deployed Meta integration, with Muse Spark 1.3 selected.
4. In the same conversation, ask: “Find products available in SMAJ Store. Show the real product names, prices, and sellers.” Inspect the returned listings and scroll the product carousel.
5. Open **Voice options** on Results to inspect playback controls. Dictation and audio require browser/OS support and permissions; their menus alone do not prove audio worked.
6. Repeat the workspace and Results captures at a 390 × 844 CSS-pixel viewport for mobile.

No production seller message, employer application, order, or payment was performed during these captures.

## Reproduce the isolated approval-and-proof captures

This uses the application’s existing optional sample mode. It deliberately uses its built-in `sample-data` planner and fictional Jobs, so it requires no Meta credentials and does not demonstrate live Meta planning. The separate public captures above do demonstrate real Meta responses.

From a normal local installation, build and start with separate temporary storage:

```sh
npm run build
SMAJ_DEMO_AUTH_ENABLED=true \
SMAJ_SAMPLE_TASKS_ENABLED=true \
SMAJ_PRODUCTION_WRITES_ENABLED=false \
SMAJ_HACKATHON_DB_PATH=/tmp/smaj-screenshots-demo.sqlite \
SMAJ_DELEGATION_DB_PATH=/tmp/smaj-screenshots-workspace.sqlite \
npm start
```

On the local application's page, use the browser console to enter the existing sample endpoint:

```js
const response = await fetch('/api/auth/demo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
if (!response.ok) throw new Error(await response.text());
location.assign('/?view=tasks');
```

Open the **Awaiting approval** sample task. Expand **Review draft**, select the two sample actions, and click **Approve 2 demo actions**. Capture the approved state, then click **Run approved actions** with **Demonstrate a retry** enabled. Expand **Task activity** after verification. Download both receipt formats using the actual Results buttons.

The gallery’s approval, execution, verification, and PDF captures follow one sample task through these steps. The **Hackathon Demo**, **Sample**, **simulated**, and **mock** labels come from the application itself. No requests or responses were mocked by the capture tooling. All writes remained in the isolated local demo database.

## Inspect the original proof

The application-exported [JSON receipt](../demo/verified-delegation-receipt.json) and [PDF certificate](../demo/verified-delegation-receipt.pdf) are included unchanged. The proof explicitly records `mock_job_application`, `productionSideEffects: false`, and `realPiPayment: false`.

Recompute the SHA-256 digest using the application's canonical JSON rule: object keys sorted recursively, array order preserved, and no extra whitespace. From the repository root:

```sh
node <<'JS'
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const receipt = require('./docs/demo/verified-delegation-receipt.json');
const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key =>
        `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const digest = createHash('sha256').update(canonical(receipt.proof)).digest('hex');
assert.equal(digest, receipt.proofHash);
assert.ok(receipt.proof.checks.every(check => check.passed));
console.log('Verified SHA-256:', digest);
JS
```

This digest covers the receipt’s `proof` object, not the raw JSON file or PDF bytes. It detects changes to that proof when compared with the recorded hash; it is not a cryptographic signature or evidence that an external party received a message.
