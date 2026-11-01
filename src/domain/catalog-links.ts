const HUB = "https://smajpihub.com";
export function listingUrl(service: string, id: string, playbackId?: string): string | undefined {
  if (!id || id.length > 200) return;
  if (service === "store") return `${HUB}/product/${encodeURIComponent(id)}`;
  if (service === "jobs") return `${HUB}/services/jobs/job/${encodeURIComponent(id)}`;
  if (service === "stream" && playbackId && /^[a-zA-Z0-9_-]{1,100}$/.test(playbackId)) return `${HUB}/app/services/stream/watch/${encodeURIComponent(playbackId)}`;
}
export function publicImage(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return;
  try { const url = new URL(value, HUB); return url.protocol === "https:" && !url.username && !url.password ? url.toString() : undefined; } catch { return; }
}
