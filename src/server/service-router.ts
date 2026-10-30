import type { ServiceId, ServicePlanStep, ServiceRoutePlan } from "@/src/domain/services";
import { SERVICE_IDS, SMAJ_SERVICES } from "@/src/domain/services";
import { AppError } from "@/src/server/http";
import { META_MODEL } from "@/src/server/meta-planner";

const META_RESPONSES_URL = "https://api.meta.ai/v1/responses";

const extractOutputText = (payload: any) => {
  const chunks: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("").trim();
};

const parseJson = (value: string) => JSON.parse(value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as any;
const clean = (value: unknown, fallback: string, limit = 500) => String(value || fallback).trim().slice(0, limit);

export class MetaServiceRouter {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async plan(task: string, connectedServiceIds: ServiceId[] = ["jobs"]): Promise<ServiceRoutePlan> {
    const request = task.trim();
    if (request.length < 12) throw new AppError("invalid_task", "Describe a specific task using at least 12 characters", 400);
    if (request.length > 2000) throw new AppError("invalid_task", "Task description must be 2,000 characters or fewer", 400);
    const apiKey = process.env.META_API_KEY?.trim();
    if (!apiKey) throw new AppError("meta_not_configured", "Meta Model API is not configured", 503);

    const connectedIds = new Set(connectedServiceIds.filter(serviceId => SERVICE_IDS.has(serviceId)));
    const catalog = SMAJ_SERVICES.map(service => ({ id: service.id, name: service.name, connected: connectedIds.has(service.id), adapterMode: service.adapterMode, capabilities: service.capabilities }));
    const prompt = [
      "You route user tasks across SMAJ PI HUB services. Return strict JSON only.",
      "Never claim an action completed. Never plan a payment, token swap, donation, purchase, booking, production submission, or medical decision as executable.",
      "Use only service IDs and capabilities from the catalog. Multi-service plans are allowed.",
      "Schema: {summary:string, services:string[], steps:[{id:string,serviceId:string,title:string,description:string,capability:string,approvalRequired:boolean}], warnings:string[]}",
      `Catalog: ${JSON.stringify(catalog)}`,
      `User task: ${request}`,
    ].join("\n");

    const response = await this.fetcher(META_RESPONSES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: META_MODEL, input: prompt, max_output_tokens: 1800, store: false, reasoning: { effort: "medium" } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new AppError("meta_planning_failed", `Meta routing failed with HTTP ${response.status}`, 502);
    const payload = await response.json();
    if (payload?.status !== "completed") throw new AppError("meta_planning_failed", `Meta routing ended with status ${payload?.status || "unknown"}`, 502);

    let parsed: any;
    try { parsed = parseJson(extractOutputText(payload)); }
    catch { throw new AppError("invalid_meta_plan", "Meta returned an invalid routing plan", 502); }
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: ServicePlanStep[] = rawSteps.map((value: any, index: number): ServicePlanStep | null => {
      const serviceId = String(value?.serviceId || "") as ServiceId;
      if (!SERVICE_IDS.has(serviceId)) return null;
      const service = SMAJ_SERVICES.find(item => item.id === serviceId)!;
      const requestedCapability = clean(value?.capability, service.capabilities[0], 100);
      const capability = service.capabilities.includes(requestedCapability) ? requestedCapability : service.capabilities[0];
      const connected = service.adapterMode === "connected" && connectedIds.has(service.id);
      return {
        id: clean(value?.id, `step-${index + 1}`, 60),
        serviceId,
        title: clean(value?.title, `${service.shortName} task`, 120),
        description: clean(value?.description, `Prepare this step with ${service.name}.`),
        capability,
        status: connected ? "approval_required" : "unavailable",
        approvalRequired: true,
        reason: connected
          ? `${service.name} supports read-only discovery and mock execution after approval.`
          : service.adapterMode === "connected"
            ? `${service.name} must be connected before this step can run.`
            : `${service.name} is planning-only until an authorized adapter is available.`,
      };
    }).filter((step: ServicePlanStep | null): step is ServicePlanStep => Boolean(step)).slice(0, 10);
    if (steps.length === 0) throw new AppError("invalid_meta_plan", "Meta did not identify a supported SMAJ service", 502);
    const services: ServiceId[] = Array.from(new Set<ServiceId>(steps.map((step: ServicePlanStep) => step.serviceId)));
    const warnings = Array.from(new Set([
      ...(Array.isArray(parsed.warnings) ? parsed.warnings.map((value: unknown) => clean(value, "", 240)).filter(Boolean) : []),
      "No Pi payment, purchase, booking, donation, swap, or production submission will be executed.",
      ...(steps.some((step: ServicePlanStep) => step.status === "unavailable") ? ["Planning-only steps are clearly blocked from execution."] : []),
    ])).slice(0, 6);
    return { summary: clean(parsed.summary, "SMAJ AI prepared a bounded, reviewable service plan.", 800), model: META_MODEL, services, steps, warnings };
  }
}
