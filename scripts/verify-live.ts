import { loadEnvConfig } from "@next/env";
import { SmajJobsReadAdapter } from "../src/server/jobs-adapter";
import { metaResponse } from "../src/server/meta-client";

loadEnvConfig(process.cwd());

async function main() {
  let failed = false;

  try {
    const { payload, model } = await metaResponse("Say hello in one sentence.", 1500);
    const hasText = payload.output?.some((item: any) => item.content?.some((content: any) => content.type === "output_text" && content.text?.trim()));
    if (!hasText) throw new Error("Meta returned no answer");
    console.log(JSON.stringify({ check: "live_meta_response", status: "passed", model }));
  } catch (error) {
    failed = true;
    console.error("Live Meta check failed:", error instanceof Error ? error.message : "Unknown error");
  }

  try {
    const adapter = new SmajJobsReadAdapter();
    const jobs = await adapter.listJobs();
    if (!jobs.length) throw new Error("No live jobs returned");
    console.log(JSON.stringify({ check: "live_jobs_read", status: "passed", count: jobs.length }));
  } catch (error) {
    failed = true;
    console.error("Live Jobs check failed:", error instanceof Error ? error.message : "Unknown error");
  }

  if (failed) process.exitCode = 1;
}

main().catch(() => {
  console.error("Live verification failed");
  process.exitCode = 1;
});
