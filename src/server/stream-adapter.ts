import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows, catalogSearchUrl } from "@/src/server/catalog-http";

export const DEFAULT_STREAM_URL = "https://smajpihub.onrender.com/stream/creator-content";

export class SmajStreamReadAdapter {
  readonly sourceUrl: string;

  constructor(sourceUrl = process.env.SMAJ_STREAM_API_URL || DEFAULT_STREAM_URL, private readonly fetcher: typeof fetch = fetch) {
    let url = new URL(sourceUrl);
    if (url.origin === "https://smajpihub.com") url = new URL(DEFAULT_STREAM_URL);
    url.pathname = "/stream/creator-content";
    this.sourceUrl = url.toString();
  }

  async listContent(query: CatalogQuery = {}) {
    const rows = catalogRows(await catalogJson(catalogSearchUrl(this.sourceUrl, query, "stream"), this.fetcher), "videos");
    return rows.map(row => {
      const id = String(row._id || row.id);
      const title = String(row.title).slice(0, 180);
      const poster = [row.posterUrl, row.thumbnailUrl].find(value => typeof value === "string" && /^https:\/\//i.test(value));
      const playbackId = typeof row.cloudflareUid === "string" && /^[a-zA-Z0-9_-]+$/.test(row.cloudflareUid)
        ? row.cloudflareUid
        : typeof row.youtubeVideoId === "string" && /^[a-zA-Z0-9_-]+$/.test(row.youtubeVideoId)
          ? `yt-${row.youtubeVideoId}`
          : "";
      return {
        id,
        title,
        creatorName: typeof row.creatorName === "string" ? row.creatorName.slice(0, 120) : "",
        imageUrl: typeof poster === "string" ? poster : undefined,
        ...(playbackId ? { url: `https://smajpihub.com/app/services/stream/watch/${playbackId}` } : {}),
        category: typeof row.category === "string" ? row.category.slice(0, 80) : "",
        description: typeof row.description === "string" ? row.description.slice(0, 600) : "",
        contentSource: "SMAJ PI HUB published creator content",
      };
    });
  }
}
