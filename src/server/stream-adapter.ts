import { listingUrl, publicImage } from "@/src/domain/catalog-links";
import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows, catalogSearchUrl } from "@/src/server/catalog-http";
export class SmajStreamReadAdapter {
  constructor(readonly sourceUrl = process.env.SMAJ_STREAM_API_URL || "https://smajpihub.onrender.com/stream/creator-content", private readonly fetcher: typeof fetch = fetch) {}
  async listContent(query: CatalogQuery = {}) {
    return catalogRows(await catalogJson(catalogSearchUrl(this.sourceUrl, query, "stream"), this.fetcher), "videos").map(row => ({ id: String(row._id || row.id), title: String(row.title).slice(0, 180), imageUrl: publicImage(row.thumbnailUrl), url: listingUrl("stream", String(row._id || row.id), typeof row.cloudflareUid === "string" && row.cloudflareUid ? row.cloudflareUid : typeof row.youtubeVideoId === "string" && row.youtubeVideoId ? `yt-${row.youtubeVideoId}` : undefined), creatorName: typeof row.creatorName === "string" ? row.creatorName.slice(0, 180) : "", category: typeof row.category === "string" ? row.category.slice(0, 100) : "", description: typeof row.description === "string" ? row.description.slice(0, 600) : "", contentSource: typeof row.contentSource === "string" ? row.contentSource : "" }));
  }
}
