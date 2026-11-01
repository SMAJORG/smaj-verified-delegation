import { createHmac } from "node:crypto";
import type { LiveAction } from "@/src/domain/services";
import { AppError } from "@/src/server/http";

export type LiveContract = { bindingConfirmed?: boolean; ownerId: string; uid: string; taskId: string; approvedAt: string; expiresAt: string };
export interface ActionAdapter { perform(contract: LiveContract, action: LiveAction, operation: "execute" | "verify"): Promise<Record<string, unknown>> }
export class HubActionAdapter implements ActionAdapter {
  constructor(private fetcher: typeof fetch = fetch) {}
  async perform(contract: LiveContract, action: LiveAction, operation: "execute" | "verify") {
    const secret = process.env.SMAJ_AI_DELEGATION_SECRET?.trim();
    if (!secret || secret.length < 32 || process.env.SMAJ_PRODUCTION_WRITES_ENABLED !== "true") throw new AppError("live_delegation_not_configured", "Live actions require SMAJ_AI_DELEGATION_SECRET and SMAJ_PRODUCTION_WRITES_ENABLED=true on both servers", 503);
    const url = new URL(process.env.SMAJ_HUB_API_ORIGIN || "https://smajpihub.onrender.com");
    if (url.protocol !== "https:" || url.username || url.password) throw new AppError("invalid_hub_origin", "Hub actions require the configured HTTPS origin", 503);
    const encoded = Buffer.from(JSON.stringify({ aud: "smaj-hub-delegation", operation, sub: contract.ownerId, uid: contract.uid, contractId: contract.taskId, approvedAt: contract.approvedAt, bindingConfirmed: contract.bindingConfirmed === true, expiresAt: contract.expiresAt, exp: Math.floor(Date.now() / 1000) + 60, action })).toString("base64url");
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
    let response: Response;
    try { response = await this.fetcher(`${url.origin}/ai-delegation/${operation}`, { method: "POST", headers: { "X-SMAJ-Delegation": `${encoded}.${signature}`, "Content-Type": "application/json" }, body: "{}", redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store" }); }
    catch { throw new AppError("hub_unreachable", "Hub action response was not received; outcome must be checked on retry", 502); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new AppError("hub_action_failed", typeof body.message === "string" ? body.message.slice(0, 400) : `Hub action failed (HTTP ${response.status})`, response.status);
    const evidence = body.evidence;
    if (!evidence || evidence.ownerId !== contract.ownerId || evidence.contractId !== contract.taskId || evidence.serviceId !== action.serviceId || evidence.recordId !== action.recordId || evidence.kind !== action.kind || typeof evidence.backendId !== "string" || !evidence.backendId || (action.kind === "save_product" ? evidence.status !== "saved" : !["submitted", "reviewing", "shortlisted", "hired", "rejected"].includes(evidence.status))) throw new AppError("verification_mismatch", "Backend evidence did not match the approved action", 409);
    return evidence as Record<string, unknown>;
  }
}
