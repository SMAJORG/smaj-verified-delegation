import { AppError } from "@/src/server/http";

const BASE = "https://api.meta.ai/v1";
const DEFAULT_META_MODEL = "muse-spark-1.3";
const MIN_OUTPUT_TOKENS = 64;
const MAX_OUTPUT_TOKENS = 8192;

const normalizeModelId = (value: string) => value.trim().replace(/^meta\//i, "");

export function extractMetaOutputText(payload: any): string {
  const chunks: string[] = [];

  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
      if (content?.type === "output_text" && Array.isArray(content.text)) {
        chunks.push(...content.text.filter((part: unknown): part is string => typeof part === "string"));
      }
    }
  }

  return chunks.join("").trim();
}

export type MetaModel = { id: string; name: string; description: string };

function conversationalModels(catalog: any): MetaModel[] {
  const items = Array.isArray(catalog?.data) ? catalog.data : Array.isArray(catalog?.models) ? catalog.models : null;
  if (!items) throw new AppError("meta_invalid_catalog", "Meta returned an invalid model catalog.", 502);
  const models = new Map<string, MetaModel>();
  for (const item of items) {
    const raw = item?.id ?? item?.model ?? item?.model_id;
    if (typeof raw !== "string" || !raw.trim() || raw.length > 200) continue;
    const id = normalizeModelId(raw);
    // Meta's documented conversational families; unknown families need explicit capability metadata.
    const family = /^muse-(spark|wonder)-[0-9]/.test(id);
    const capabilities = item.capabilities;
    const declared = capabilities?.conversation === true || capabilities?.chat === true || (Array.isArray(capabilities) && capabilities.some((value: unknown) => value === "chat" || value === "conversation"));
    const incompatible = /^(muse-(image|voice|glimmer)|sam-)/.test(id) || item.available === false || capabilities?.chat === false || capabilities?.conversation === false;
    if (incompatible || (!family && !declared)) continue;
    const name = typeof item.name === "string" ? item.name.slice(0, 100) : id.replace(/^muse-(spark|wonder)/, (_, line: string) => `Muse ${line[0].toUpperCase()}${line.slice(1)}`).replace(/-/g, " ");
    const description = typeof item.description === "string" && item.description.trim() ? item.description.slice(0, 180) : id.includes("wonder") ? "Complex reasoning and multi-step tasks." : "Everyday conversation, coding, and task planning.";
    models.set(id, { id, name, description: description + (id.endsWith("-contributor") ? " Contributor mode: content may be used to train Meta models." : "") });
  }
  return [...models.values()];
}

function apiKey() {
  const key = (process.env.META_API_KEY || process.env.MODEL_API_KEY)?.trim();
  if (!key) throw new AppError("meta_not_configured", "AI credentials are not configured: set server-only META_API_KEY (or MODEL_API_KEY) and META_MODEL.", 503);
  return key;
}

export async function listMetaModels(fetcher: typeof fetch = fetch) {
  const models = conversationalModels(await request("models", apiKey(), fetcher));
  if (!models.length) throw new AppError("meta_no_conversational_models", "Meta GET /v1/models returned no compatible conversational models. No AI request was sent.", 503);
  const configured = normalizeModelId(process.env.META_MODEL || "");
  const defaultModel = models.find(model => model.id === DEFAULT_META_MODEL)?.id || models.find(model => model.id === configured)?.id || models[0].id;
  return { models, defaultModel };
}

async function request(path: string, apiKey: string, fetcher: typeof fetch, body?: unknown) {
  let response: Response;

  try {
    response = await fetcher(`${BASE}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(path === "models" ? 10_000 : 60_000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new AppError("meta_unreachable", "The AI provider could not be reached. Please retry.", 502);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const rawCode = payload?.error?.code;
    const code = typeof rawCode === "string" && /^[a-z_]{1,64}$/.test(rawCode) ? rawCode : "request_failed";

    console.error(JSON.stringify({
      provider: "meta",
      operation: path,
      status: response.status,
      code,
      requestId: response.headers.get("x-request-id"),
      // Provider error bodies can echo inputs or secrets; log codes and request IDs only.
    }));

    const message = code === "model_not_found"
      ? "The configured AI model is unavailable to this Meta account. Check META_MODEL against the account model catalog."
      : response.status === 401 || response.status === 403
        ? `Meta ${path} rejected the server credentials or account permissions (HTTP ${response.status}, ${code}).`
        : response.status === 429
          ? "The AI provider quota or rate limit was reached. Please retry later."
          : `The AI provider request failed (HTTP ${response.status}, ${code}). Please retry or contact support.`;

    throw new AppError(`meta_${code}`, message, response.status === 429 ? 429 : 502);
  }

  try { return await response.json(); }
  catch { throw new AppError("meta_invalid_response", "Meta returned invalid JSON.", 502); }
}

export async function metaResponse(input: string | Record<string, unknown>[], maxTokens: number, fetcher: typeof fetch = fetch, selectedModel?: string) {
  const key = apiKey();
  if (process.env.META_MODEL !== undefined && !process.env.META_MODEL.trim() && selectedModel === undefined) throw new AppError("meta_model_not_configured", "AI is unavailable: configure META_MODEL using a model available to your Meta account.", 503);
  const { models, defaultModel } = await listMetaModels(fetcher);
  const model = selectedModel === undefined ? defaultModel : selectedModel;
  if (!models.some(candidate => candidate.id === model)) throw new AppError("meta_model_not_available", "The selected model is no longer available. Choose an available model and retry; your conversation and approvals are saved.", 409);

  const requestedTokens = Number(maxTokens) > 0 ? Math.max(MIN_OUTPUT_TOKENS, Number(maxTokens)) : MIN_OUTPUT_TOKENS;
  let outputTokens = Math.min(requestedTokens, MAX_OUTPUT_TOKENS);
  let payload: any;
  while (true) {
    payload = await request("responses", key, fetcher, { model, input, max_output_tokens: outputTokens, store: false });
    const reason = typeof payload?.incomplete_details?.reason === "string" ? payload.incomplete_details.reason : "";
    if (payload?.status !== "incomplete" || reason !== "max_output_tokens" || outputTokens >= MAX_OUTPUT_TOKENS) break;
    outputTokens = Math.min(outputTokens * 2, MAX_OUTPUT_TOKENS);
  }
  if (payload?.status !== "completed") {
    const status = typeof payload?.status === "string" && /^[a-z_]{1,32}$/.test(payload.status) ? payload.status : "unknown";
    const failureReason = typeof payload?.incomplete_details?.reason === "string" && /^[a-z_]{1,64}$/.test(payload.incomplete_details.reason)
      ? payload.incomplete_details.reason
      : "unknown";
    console.error(JSON.stringify({ provider: "meta", event: "response_not_completed", status, reason: failureReason, requestId: typeof payload?.id === "string" ? payload.id : null }));
    throw new AppError("meta_incomplete", `Meta returned an incomplete response (${status}${failureReason !== "unknown" ? `: ${failureReason}` : ""}). Please retry.`, 502);
  }

  if (!extractMetaOutputText(payload)) throw new AppError("meta_empty_response", "Meta returned no answer text. Please retry.", 502);
  const actualModel = typeof payload.model === "string" ? payload.model : model;
  return { payload, model: actualModel, provenance: { provider: "meta" as const, model: actualModel, responseId: typeof payload.id === "string" ? payload.id : null, receivedAt: new Date().toISOString() } };
}
