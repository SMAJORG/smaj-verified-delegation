# Verified Delegation demo

The reproducible walkthrough uses the real Meta Model API and the read-only published SMAJ Jobs catalog, then writes only local mock application records. It does not submit applications to employers or make Pi payments.

## Judge walkthrough

1. Configure the app as described below and start it with `npm run dev`.
2. In a second terminal, start the runner with `npm run demo`. It creates a signed session, fetches current published Jobs records, and asks Meta to rank up to two matches and draft application notes.
3. Review the recommendation summary. Unless `DEMO_AUTO_APPROVE=1`, the runner pauses for explicit human approval before continuing.
4. The runner injects one transient failure, retries with the same idempotency key, and verifies that the approved mock submissions are persisted without duplicates.
5. Review the event log, verification result, and SHA-256 proof digest. The receipt records the simulation boundary and verification checks.

The public browser demo at [ai.smajpihub.com](https://ai.smajpihub.com) is a separate anonymous workspace for trying supported AI requests. Do not assume its task history is preloaded with the CLI workflow's sample records.

## Configure

Copy `.env.example` to `.env.local` and set server-side values:

```dotenv
META_API_KEY=your_meta_api_key
META_MODEL=exact_model_id_from_your_account_catalog
SMAJ_DEMO_ACCESS_TOKEN=a_random_secret_at_least_16_characters
```

Use an exact model ID available to the configured key from `GET https://api.meta.ai/v1/models`. The application reads that catalog but only logs a mismatch before trying the Responses request; it does not strictly validate the ID locally. Keep credentials out of Git and never add a `NEXT_PUBLIC_` prefix.

For the demonstration, use a writable local SQLite path, keep it separate from production data, and ensure the running app and script use the same `SMAJ_DEMO_ACCESS_TOKEN`. The default Jobs source is the published SMAJ PI HUB endpoint configured by `SMAJ_JOBS_API_URL`.

## Launch

Terminal one:

```sh
npm ci
npm run dev
```

Terminal two, with the same token available in the process environment:

```sh
SMAJ_DEMO_ACCESS_TOKEN=your_local_demo_token npm run demo
```

For unattended automation only:

```sh
SMAJ_DEMO_ACCESS_TOKEN=your_local_demo_token DEMO_AUTO_APPROVE=1 npm run demo
```

The browser workspace itself can be opened at [http://localhost:3000](http://localhost:3000). Public AI requests require server-side Meta credentials. Production submissions and real Pi payments remain disabled by default.
