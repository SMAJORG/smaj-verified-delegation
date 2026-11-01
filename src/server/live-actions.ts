import { createHmac } from "node:crypto";
import type { JobApplicationPreview, LiveAction } from "@/src/domain/services";
import { AppError } from "@/src/server/http";

export type LiveContract = { ownerId: string; uid: string; taskId: string; approvedAt: string; expiresAt: string };
export type PreparationContract = { ownerId: string; uid: string; taskId: string };
export interface ActionAdapter {
  perform(contract: LiveContract, action: LiveAction, operation: "execute" | "verify"): Promise<Record<string, unknown>>;
  prepare?(contract: PreparationContract, action: LiveAction): Promise<JobApplicationPreview>;
}
export class HubActionAdapter implements ActionAdapter {
  constructor(private fetcher: typeof fetch = fetch) {}
  private async request(contract: PreparationContract & Partial<Pick<LiveContract, "approvedAt" | "expiresAt">>, action: LiveAction, operation: "prepare" | "execute" | "verify") {
    const secret = process.env.SMAJ_AI_DELEGATION_SECRET?.trim();
    if (!secret || secret.length < 32 || (operation === "execute" && process.env.SMAJ_PRODUCTION_WRITES_ENABLED !== "true")) throw new AppError("live_delegation_not_configured", "Live actions require SMAJ_AI_DELEGATION_SECRET and SMAJ_PRODUCTION_WRITES_ENABLED=true on both servers", 503);
    const url = new URL(process.env.SMAJ_HUB_API_ORIGIN || "https://smajpihub.com");
    if (url.protocol !== "https:" || url.username || url.password) throw new AppError("invalid_hub_origin", "Hub actions require the configured HTTPS origin", 503);
    const encoded = Buffer.from(JSON.stringify({
      aud: "smaj-hub-delegation",
      operation,
      sub: contract.ownerId,
      uid: contract.uid,
      contractId: contract.taskId,
      ...(contract.approvedAt ? { approvedAt: contract.approvedAt } : {}),
      ...(contract.expiresAt ? { expiresAt: contract.expiresAt } : {}),
      ...(operation !== "prepare" ? { bindingConfirmed: true } : {}),
      ...(action.applicationPreview ? { applicationDetailsHash: action.applicationPreview.detailsHash } : {}),
      exp: Math.floor(Date.now() / 1000) + 60,
      action,
    })).toString("base64url");
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
    let response: Response;
    try { response = await this.fetcher(`${url.origin}/ai-delegation/${operation}`, { method: "POST", headers: { "X-SMAJ-Delegation": `${encoded}.${signature}`, "Content-Type": "application/json" }, body: "{}", redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new AppError("hub_unreachable", "Hub action response was not received; outcome must be checked on retry", 502); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new AppError("hub_action_failed", typeof body.message === "string" ? body.message.slice(0, 400) : `Hub action failed (HTTP ${response.status})`, response.status);
    return body;
  }
  async prepare(contract: PreparationContract, action: LiveAction) {
    if (action.serviceId !== "jobs" || action.kind !== "apply") throw new AppError("unsupported_preparation", "Only job applications can be prepared", 400);
    const body = await this.request(contract, action, "prepare");
    const preview = body.preview as JobApplicationPreview | undefined;
    if (!preview || typeof preview.detailsHash !== "string" || !preview.detailsHash || preview.job?.recordId !== action.recordId || !preview.profile?.title || typeof preview.cv?.attached !== "boolean") {
      throw new AppError("invalid_application_preview", "Hub did not return a complete application review", 502);
    }
    return preview;
  }
  async perform(contract: LiveContract, action: LiveAction, operation: "execute" | "verify") {
    const body = await this.request(contract, action, operation);
    const evidence = body.evidence;
    if (!evidence || evidence.ownerId !== contract.ownerId || evidence.contractId !== contract.taskId || evidence.serviceId !== action.serviceId || evidence.recordId !== action.recordId || evidence.kind !== action.kind || typeof evidence.backendId !== "string" || !evidence.backendId || (action.kind === "save_product" ? evidence.status !== "saved" : !["submitted", "reviewing", "shortlisted", "hired", "rejected"].includes(evidence.status) || typeof evidence.createdAt !== "string" || evidence.applicationDetailsHash !== action.applicationPreview?.detailsHash || typeof evidence.idempotencyKey !== "string" || !evidence.idempotencyKey)) throw new AppError("verification_mismatch", "Backend evidence did not match the approved action", 409);
    return evidence as Record<string, unknown>;
  }
}
