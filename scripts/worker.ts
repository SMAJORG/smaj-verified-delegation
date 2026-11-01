import { loadEnvConfig } from "@next/env";
import { getDatabase } from "../src/server/database";
import { LiveWorkflow } from "../src/server/live-workflow";
loadEnvConfig(process.cwd());
let stopped = false;
process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });
async function main() {
  const db = getDatabase(); const workflow = new LiveWorkflow(db);
  console.log("Live delegation worker started; queued actions require prior persisted approval.");
  while (!stopped) {
    try { if (await workflow.tick()) continue; }
    catch { console.error("Worker failed; persisted leases will be recovered."); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  db.close();
}
main().catch(() => { console.error("Worker startup failed"); process.exitCode = 1; });
