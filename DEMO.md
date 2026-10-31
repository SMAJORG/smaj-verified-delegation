# Reproducible Hackathon Demo

## Judge walkthrough (no credentials required)

1. Open the application and select **Try Live Demo**.
2. Select **Explore sample tasks** to see an awaiting-approval task, an approved task, and a verified result.
3. Open the awaiting-approval task, review the fictional opportunities and drafts, and approve the selected mock actions.
4. Execute the approved plan with recovery enabled. Inspect its audit trail, independent checks, and downloadable proof receipt.
5. Try creating another task, or connect the sample Store catalog. Planning and sensitive actions remain simulated.
6. Select **Exit demo** to revoke the session and delete its sample workspace. Each new visit gets a fresh workspace; sessions expire after one hour.

This mode requires no API key or access token and makes no outbound service calls. Keep `SMAJ_DEMO_AUTH_ENABLED=true`. Demo data lives in `SMAJ_HACKATHON_DB_PATH` (default `./data/hackathon-demo.sqlite`), which must differ from production storage. The UI and receipts identify simulated data and planning.

## Existing live-planning script

The optional script below uses the live read-only SMAJ Jobs endpoint and Meta `muse-spark-1.3`, but writes only mock application records to the regular application's local database. It retains the existing access-token authentication and is separate from the judge walkthrough.

## Configure

Set these values in `.env.local` without committing them:

```dotenv
META_API_KEY=your_meta_key
SMAJ_DEMO_ACCESS_TOKEN=a_random_secret_at_least_16_characters
```

## Launch

Terminal one:

```powershell
npm.cmd run dev
```

Terminal two:

```powershell
$env:SMAJ_DEMO_ACCESS_TOKEN="the_same_random_secret"
npm.cmd run demo
```

The script pauses at the human approval gate, injects one controlled transient failure, follows persisted progress, and prints the final SHA-256 proof digest. Set `DEMO_AUTO_APPROVE=1` for an unattended judging run.

The browser dashboard at `http://localhost:3000` provides the same flow with signed-session login, live server events, persistent history, approval controls, restart recovery, and downloadable proof receipts.
