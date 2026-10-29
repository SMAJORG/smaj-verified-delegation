# Reproducible Hackathon Demo

The demo uses the live read-only SMAJ Jobs endpoint and Meta `muse-spark-1.3`, but writes only mock application records to this repository's stable local database.

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
