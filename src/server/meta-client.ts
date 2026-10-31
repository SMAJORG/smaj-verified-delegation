import { AppError } from "@/src/server/http";

const BASE = "https://api.meta.ai/v1";

async function request(path: string, apiKey: string, fetcher: typeof fetch, body?: unknown) {
  let response: Response;
  try {
    response = await fetcher(`${BASE}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60_000), cache: "no-store",
    });
  } catch {
    throw new AppError("meta_unreachable", "The AI provider could not be reached. Please retry.", 502);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const rawCode = payload?.error?.code;
    const code = typeof rawCode === "string" && /^[a-z_]{1,64}$/.test(rawCode) ? rawCode : "request_failed";
    console.error(JSON.stringify({ provider: "meta", operation: path, status: response.status, code, requestId: response.headers.get("x-request-id") }));
    const message = code === "model_not_found" ? "The configured AI model is unavailable to this Meta account. Check META_MODEL against the account model catalog."
      : response.status === 401 || response.status === 403 ? "Meta rejected the server credentials or account permissions."
      : response.status === 429 ? "The AI provider quota or rate limit was reached. Please retry later."
      : `The AI provider request failed (HTTP ${response.status}, ${code}). Please retry or contact support.`;
    throw new AppError(`meta_${code}`, message, response.status === 429 ? 429 : 502);
  }
  return response.json();
}

export async function metaResponse(input: string, maxTokens: number, fetcher: typeof fetch = fetch) {
  const apiKey = (process.env.META_API_KEY || process.env.MODEL_API_KEY)?.trim();
  const model = process.env.META_MODEL?.trim();
  if (!apiKey) throw new AppError("meta_not_configured", "AI is unavailable: the server Meta API key is not configured.", 503);
  if (!model) throw new AppError("meta_model_not_configured", "AI is unavailable: configure META_MODEL using a model available to your Meta account.", 503);
  const catalog = await request("models", apiKey, fetcher);
  if (!Array.isArray(catalog?.data) || !catalog.data.some((item: { id?: string }) => item.id === model)) {
    throw new AppError("meta_model_not_available", "The configured AI model is not in this account's available model catalog. No AI request was sent.", 503);
  }
  const payload = await request("responses", apiKey, fetcher, { model, input, max_output_tokens: maxTokens, store: false });
  if (payload?.status !== "completed") throw new AppError("meta_incomplete", "The AI response did not complete. Please retry.", 502);
  return { payload, model };
}
