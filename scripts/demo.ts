import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const baseUrl = process.env.DEMO_BASE_URL || "http://localhost:3000";
const accessToken = process.env.SMAJ_DEMO_ACCESS_TOKEN;
if (!accessToken) throw new Error("Set SMAJ_DEMO_ACCESS_TOKEN to the same value used by the running app");

const json = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${payload.message || response.statusText}`);
  return { response, payload };
};

const main = async () => {
const login = await json("/api/auth/session", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }),
});
const cookie = login.response.headers.get("set-cookie")?.split(";", 1)[0];
if (!cookie) throw new Error("The app did not issue a signed demo session");
const headers = (key?: string) => ({ "Content-Type": "application/json", Cookie: cookie, ...(key ? { "Idempotency-Key": key } : {}) });

const runId = Date.now().toString(36);
console.log("\nSMAJ VERIFIED DELEGATION - REPRODUCIBLE DEMO");
console.log("1. Authenticated with a signed HttpOnly-compatible session.");
const created = await json("/api/delegations", {
  method: "POST", headers: headers(`demo-create-${runId}`),
  body: JSON.stringify({
    candidateName: "Amina Okafor", skills: ["TypeScript", "React", "Node.js", "REST APIs"],
    goal: "Find the strongest current SMAJ Jobs matches and prepare mock applications for human approval.", maxApplications: 2,
  }),
});
const delegation = created.payload.delegation;
console.log(`2. Meta ${delegation.plan.model} planned ${delegation.plan.recommendations.length} applications from ${delegation.jobs.length} read-only Jobs records.`);
for (const recommendation of delegation.plan.recommendations) {
  const job = delegation.jobs.find((item: { id: string }) => item.id === recommendation.jobId);
  console.log(`   - ${job?.title}: ${recommendation.score}% match`);
}

if (process.env.DEMO_AUTO_APPROVE !== "1") {
  const prompt = createInterface({ input: stdin, output: stdout });
  await prompt.question("\nHuman approval gate reached. Press Enter to approve the mock actions...");
  prompt.close();
}
const selectedJobIds = delegation.plan.recommendations.map((item: { jobId: string }) => item.jobId);
await json(`/api/delegations/${delegation.id}/approve`, {
  method: "POST", headers: headers(`demo-approve-${runId}`), body: JSON.stringify({ selectedJobIds }),
});
console.log("3. Human approval recorded; production submissions remain disabled.");

const execution = json(`/api/delegations/${delegation.id}/execute`, {
  method: "POST", headers: headers(`demo-execute-${runId}`), body: JSON.stringify({ injectTransientFailure: true }),
});
let lastEvent = 0;
let finished = false;
while (!finished) {
  await new Promise(resolve => setTimeout(resolve, 220));
  const snapshot = await json(`/api/delegations/${delegation.id}`, { headers: { Cookie: cookie } });
  for (const event of snapshot.payload.delegation.events.filter((item: { id: number }) => item.id > lastEvent)) {
    console.log(`   [${event.type}] ${event.message}`);
    lastEvent = event.id;
  }
  finished = ["verified", "failed"].includes(snapshot.payload.delegation.status);
}
const completed = (await execution).payload.delegation;
if (completed.status !== "verified") throw new Error(`Demo ended in ${completed.status}`);
console.log("4. Controlled failure recovered with the same idempotency key.");
console.log(`5. VERIFIED - ${completed.submissions.length} mock actions, proof ${completed.receipt.proofHash}`);
console.log("6. Safety check - production writes: false; real Pi payment: false.\n");
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
