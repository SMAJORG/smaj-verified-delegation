import { AppError } from "@/src/server/http";

// Only the operator can choose the backend; never follow model/user supplied URLs.
export async function catalogJson(source: string, fetcher: typeof fetch = fetch): Promise<Record<string, unknown>> {
  const url = new URL(source);
  const origin = new URL(process.env.SMAJ_HUB_API_ORIGIN || "https://smajpihub.onrender.com").origin;
  if (url.origin !== origin || url.protocol !== "https:" || url.username || url.password || url.hash) throw new AppError("invalid_catalog_url", "Catalog URL must use the configured HTTPS HUB origin", 503);
  if (!["/jobs/jobs", "/marketplace/products", "/stream/creator-content"].includes(url.pathname)) throw new AppError("invalid_catalog_url", "Catalog path is not allowlisted", 503);
  const response = await fetcher(url.toString(), { method: "GET", headers: { Accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new AppError("catalog_unavailable", `HUB catalog returned HTTP ${response.status}`, 502);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty catalog response");
  const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1_000_000) throw new Error("Catalog response too large"); chunks.push(value); } }
  finally { await reader.cancel(); }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid catalog payload");
  return body;
}
export function catalogRows(body: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const rows = body[key];
  if (!Array.isArray(rows) || rows.length > 100 || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid catalog records");
  for (const row of rows) if (typeof (row.id || row._id || row.slug) !== "string" || typeof row.title !== "string" || !row.title.trim()) throw new Error("Catalog record lacks identity or title");
  return rows;
}
