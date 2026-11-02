import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows, catalogSearchUrl } from "@/src/server/catalog-http";
export class SmajStreamReadAdapter {
  readonly sourceUrl: string;

  constructor(sourceUrl = process.env.SMAJ_STREAM_API_URL || "https://smajpihub.com/stream/search", private readonly fetcher: typeof fetch = fetch) {
    const url = new URL(sourceUrl);
    if (url.pathname === "/stream/creator-content") url.pathname = "/stream/search";
    this.sourceUrl = url.toString();
  }

  async listContent(query: CatalogQuery = {}) {
    const rows = catalogRows(await catalogJson(catalogSearchUrl(this.sourceUrl, query, "stream"), this.fetcher), "results");
    return rows.map(row => {
      const id = String(row.id || row._id || row.slug);
      const mediaType = row.mediaType === "tv" ? "tv" : "movie";
      const title = String(row.title).slice(0, 180);
      const poster = [row.posterUrl, row.backdropUrl].find(value => typeof value === "string" && /^https:\/\//i.test(value));
      return {
        id,
        title,
        creatorName: "",
        imageUrl: typeof poster === "string" ? poster : undefined,
        url: `https://smajpihub.com/app/services/stream/${mediaType === "tv" ? "series" : "title"}/${encodeURIComponent(id)}`,
        category: "",
        description: typeof row.overview === "string" ? row.overview.slice(0, 600) : "",
        mediaType,
        releaseDate: typeof row.releaseDate === "string" ? row.releaseDate : "",
        rating: typeof row.rating === "number" && Number.isFinite(row.rating) ? row.rating : undefined,
        contentSource: "SMAJ PI HUB Stream catalog",
      };
    });
  }
}
