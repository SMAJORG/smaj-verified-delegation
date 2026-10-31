import type { ServiceId, ServicePlanStep, ServiceRoutePlan } from "@/src/domain/services";
import { SERVICE_IDS, SMAJ_SERVICES } from "@/src/domain/services";
import { AppError } from "@/src/server/http";
import { extractMetaOutputText, metaResponse } from "@/src/server/meta-client";

const clean = (value: unknown, fallback: string, limit = 500) => String(value ?? fallback).trim().slice(0, limit);

const parseJsonCandidate = (value: string): any => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("empty response");

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const narrowed = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  const parsed = JSON.parse(narrowed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("response is not an object");
  }
  return parsed;
};

const isValidPlan = (parsed: any) => {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return false;
  if (!Array.isArray(parsed.steps)) return false;
  if (!Array.isArray(parsed.services)) return false;
  if (!Array.isArray(parsed.warnings)) return false;
  return true;
};

const buildRoutingPrompt = (catalog: unknown[], request: string) => [
  "You are SMAJ AI. Answer the user helpfully and route tasks across SMAJ PI HUB services.",
  "Return only one valid JSON object with no markdown, no reasoning, and no extra text.",
  "Schema: {\"summary\": string, \"services\": string[], \"steps\": [{\"id\": string, \"serviceId\": string, \"title\": string, \"description\": string, \"capability\": string, \"approvalRequired\": boolean}], \"warnings\": string[] }",
  "For greetings or tasks that need no service, return summary as the direct answer and services: [], steps: [], warnings: [].",
  "For all other tasks, use only service IDs from the catalog and only valid capabilities from those services.",
  "Never claim an action completed. Never plan a payment, token swap, donation, purchase, booking, production submission, or medical decision as executable.",
  "Allowed service IDs are the exact strings in the catalog: use only those IDs.",
  "If a step cannot be executed because a service is unavailable or not connected, still include it as a planning step only when it is relevant, and set approvalRequired to true.",
  `Catalog: ${JSON.stringify(catalog)}`,
  `User task: ${request}`,
].join("\n");

const buildRetryPrompt = (catalog: unknown[], request: string) => [
  "Return only strict JSON.",
  "No prose, no code fences, no analysis text, no markdown, no trailing commas.",
  "Object keys must be exactly: summary, services, steps, warnings.",
  "summary must be a short plain-language summary.",
  "services must be an array of valid SMAJ service IDs only.",
  "steps must be an array of objects with exact keys: id, serviceId, title, description, capability, approvalRequired.",
  "serviceId must be one of the exact valid IDs from the catalog; do not invent IDs.",
  "approvalRequired must be boolean.",
  "warnings must be an array of strings.",
  `Catalog: ${JSON.stringify(catalog)}`,
  `User task: ${request}`,
].join("\n");

export class MetaServiceRouter {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async plan(task: string, connectedServiceIds: ServiceId[] = ["jobs"]): Promise<ServiceRoutePlan> {
    const request = task.trim();
    if (!request) throw new AppError("invalid_task", "Enter a message or task", 400);
    if (request.length > 2000) throw new AppError("invalid_task", "Task description must be 2,000 characters or fewer", 400);

    const connectedIds = new Set(connectedServiceIds.filter(serviceId => SERVICE_IDS.has(serviceId)));
    const catalog = SMAJ_SERVICES.map(service => ({
      id: service.id,
      name: service.name,
      connected: connectedIds.has(service.id),
      adapterMode: service.adapterMode,
      capabilities: service.capabilities,
    }));

    const parsePlanFromPayload = async (promptText: string): Promise<{ parsed: any; model: string }> => {
      const { payload, model } = await metaResponse(promptText, 1800, this.fetcher);
      const rawText = extractMetaOutputText(payload);
      try {
        const parsed = parseJsonCandidate(rawText);
        if (!isValidPlan(parsed)) {
          throw new Error("missing required plan fields");
        }
        return { parsed, model };
      } catch (error) {
        console.warn(JSON.stringify({
          provider: "meta",
          event: "invalid_plan_response",
          model,
          sample: rawText.slice(0, 1200),
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    };

    try {
      const { parsed, model } = await parsePlanFromPayload(buildRoutingPrompt(catalog, request));
      return this.normalizePlan(parsed, model, connectedIds);
    } catch (firstError) {
      try {
        const { parsed, model } = await parsePlanFromPayload(buildRetryPrompt(catalog, request));
        return this.normalizePlan(parsed, model, connectedIds);
      } catch (retryError) {
        console.error(JSON.stringify({
          provider: "meta",
          event: "routing_plan_retry_failed",
          task: request.slice(0, 200),
          error: retryError instanceof Error ? retryError.message : String(retryError),
        }));
        throw new AppError("invalid_meta_plan", "Meta returned an invalid routing plan. Please retry with a simpler task or check the connected services.", 502);
      }
    }
  }

  private normalizePlan(parsed: any, model: string, connectedIds: Set<ServiceId>): ServiceRoutePlan {
    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps: ServicePlanStep[] = rawSteps
      .map((value: any, index: number): ServicePlanStep | null => {
        const serviceId = String(value?.serviceId ?? value?.service_id ?? "") as ServiceId;
        if (!SERVICE_IDS.has(serviceId)) return null;
        const service = SMAJ_SERVICES.find(item => item.id === serviceId)!;
        const requestedCapability = clean(value?.capability ?? service.capabilities[0], service.capabilities[0], 120);
        const capability = service.capabilities.includes(requestedCapability) ? requestedCapability : service.capabilities[0];
        const connected = service.adapterMode === "connected" && connectedIds.has(service.id);
        return {
          id: clean(value?.id ?? `step-${index + 1}`, `step-${index + 1}`, 60),
          serviceId,
          title: clean(value?.title ?? `${service.shortName} task`, `${service.shortName} task`, 120),
          description: clean(value?.description ?? `Prepare this step with ${service.name}.`, `Prepare this step with ${service.name}.`, 300),
          capability,
          status: connected ? "approval_required" : "unavailable",
          approvalRequired: Boolean(value?.approvalRequired ?? true),
          reason: connected
            ? `${service.name} supports read-only discovery and mock execution after approval.`
            : service.adapterMode === "connected"
              ? `${service.name} must be connected before this step can run.`
              : `${service.name} is planning-only until an authorized adapter is available.`,
        };
      })
      .filter((step: ServicePlanStep | null): step is ServicePlanStep => Boolean(step))
      .slice(0, 10);

    const summaryText = typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "SMAJ AI prepared a bounded, reviewable service plan.";

    const services: ServiceId[] = Array.from(new Set<ServiceId>(
      Array.isArray(parsed.services)
        ? parsed.services
            .map((value: unknown) => String(value || "").trim())
            .filter((value): value is ServiceId => SERVICE_IDS.has(value as ServiceId))
        : [],
    ));

    const warnings = Array.from(new Set([
      ...(Array.isArray(parsed.warnings) ? parsed.warnings.map((value: unknown) => clean(value, "", 240)).filter(Boolean) : []),
      "No Pi payment, purchase, booking, donation, swap, or production submission will be executed.",
      ...(steps.some((step: ServicePlanStep) => step.status === "unavailable") ? ["Planning-only steps are clearly blocked from execution."] : []),
    ])).slice(0, 6);

    const validServices = services.length ? services : steps.map(step => step.serviceId);

    return {
      summary: clean(summaryText, "SMAJ AI prepared a bounded, reviewable service plan.", 800),
      model,
      services: Array.from(new Set(validServices)).slice(0, 10),
      steps,
      warnings,
    };
  }
}




































































































































































































































































































