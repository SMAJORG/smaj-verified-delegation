import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows, catalogSearchUrl } from "@/src/server/catalog-http";
export class SmajStreamReadAdapter {
  constructor(readonly sourceUrl = process.env.SMAJ_STREAM_API_URL || "https://smajpihub.onrender.com/stream/creator-content", private readonly fetcher: typeof fetch = fetch) {}
  async listContent(query: CatalogQuery = {}) {
    return catalogRows(await catalogJson(catalogSearchUrl(this.sourceUrl, query, "stream"), this.fetcher), "videos").map(row => ({ id: String(row._id || row.id), title: String(row.title).slice(0, 180), creatorName: typeof row.creatorName === "string" ? row.creatorName.slice(0, 180) : "", imageUrl: typeof row.thumbnailUrl === "string" ? row.thumbnailUrl : undefined, url: typeof row.youtubeVideoId === "string" && row.youtubeVideoId ? `https://smajpihub.com/app/services/stream/watch/yt-${encodeURIComponent(row.youtubeVideoId)}` : typeof row.cloudflareUid === "string" && row.cloudflareUid ? `https://smajpihub.com/app/services/stream/watch/${encodeURIComponent(row.cloudflareUid)}` : undefined, category: typeof row.category === "string" ? row.category.slice(0, 100) : "", description: typeof row.description === "string" ? row.description.slice(0, 600) : "", contentSource: typeof row.contentSource === "string" ? row.contentSource : "" }));
  }
}
