SMAJ AI — Verified Delegation
Meta Global AI Developer Hackathon 2026 | Startup Track
One integrated project. Real-world actions. Verifiable results.
Prepared for: SMAJ Ecosystem Ltd. | Product: SMAJ PI HUB | Date: October 2026
1. Executive concept
SMAJ PI HUB is positioned as a Pi-powered digital economic utility layer connecting verified people and
businesses to commerce, work, and real-world services. The hackathon contribution is SMAJ Verified Delegation:
an AI agent that accepts an authorized goal, plans and executes bounded actions, checks actual backend outcomes,
recovers safely from failures, and issues evidence-backed receipts.
Focus: Start with SMAJ STORE and SMAJ PI JOBS. Do not claim that planned services or autonomous features
are already live.
2. Awards strategy — one entry, several possible categories
Category
Shown award
What to demonstrate
Startup Track — 1st
Most Viral Project
$250,000
$20,000
Useful, scalable product and convincing traction
Authentic public demo and community reach
Best Meta Open-Weight Build
Community Vote
$10,000
$10,000
Meaningful use of Meta open-weight models
Genuine community participation
Best Agentic Use-Case
Best Creative Build
$5,000
$5,000
Multi-step execution, recovery and verification
Clear, compelling interaction and visualization
Maximum arithmetic total shown: $300,000. This is not a guaranteed or confirmed combinable payout. Ask
organizers whether one entry can receive multiple bonus prizes and whether separate nominations are required.
3. MVP: what to build
Delegation contract: Convert a user goal into a bounded task with permissions, success criteria and expiry.
Meta-powered planner: Use an eligible Meta model for substantive planning and decisions; record model/version.
Durable execution: Persist jobs in a queue so approved tasks can resume when the user is offline.
Deterministic verification: Check actual Store/Jobs database or API state before declaring success.
Safe recovery: Retry transient errors with idempotency; stop and request approval for irreversible actions.
Proof dashboard: Display actions, timestamps, evidence, errors, and verified receipts.
4. Demo script (2–3 minutes)
1. User authorizes: “Find three matching jobs, prepare applications, and submit only after my approval.”
2. Agent identifies jobs and drafts applications using a Meta model.
3. User approves; agent submits through the Jobs API, even if the UI is closed.
SMAJ AI Hackathon Strategy  •  1
4. Introduce a controlled API failure; show safe retry without duplicate applications.
5. Display database-confirmed submission receipts, including any failures and reasons.
5. Architecture and repository plan
Existing product: smajorg/smajpihub (retain current app).
New public hackathon repository: smajorg/smaj-verified-delegation (agent, API adapters, verifier, tests, demo,
documentation).
Stack: Next.js/TypeScript interface; Node backend; persistent database and job queue; Meta Model API or eligible
Meta open-weight model; controlled Store/Jobs integrations. Keep API keys on the server.
6. Evaluation evidence
Publish a repeatable benchmark: task success rate, verified-success rate, false-success claims, duplicate-action
rate, recovery rate and median completion time. Compare a basic agent against the same agent with deterministic
verification and safe retries. Report actual measured results; do not invent numbers.
7. Delivery sequence
Phase 1: Confirm official model access and rules; publish repo and architecture.
Phase 2: Implement one Jobs workflow end-to-end with permission checks.
Phase 3: Add persistence, verifier, fault injection, and receipts.
Phase 4: Add a limited Store workflow, benchmarks, and a polished demo.
Phase 5: Publish documentation, demo video, community updates and submission.
8. Guardrails and claims
Never auto-spend Pi or submit binding transactions without explicit authorization. Protect personal data and avoid
exposing private code or credentials. Public materials must distinguish existing SMAJ PI HUB features from work
newly built during the hackathon. Model IDs, credit eligibility, and award-stacking rules must be verified against
current organizer documentation.
Positioning statement
“SMAJ Verified Delegation turns AI intentions into authorized, independently verified actions across a
real-world digital economic layer.”
Company: smaj.org    |    Product: smajpihub.com    |    GitHub: github.com/smajorg
SMAJ AI Hackathon Strategy  •  2
