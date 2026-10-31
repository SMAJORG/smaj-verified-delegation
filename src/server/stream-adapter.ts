import { catalogJson, catalogRows } from "@/src/server/catalog-http";
export class SmajStreamReadAdapter {
  constructor(readonly sourceUrl = process.env.SMAJ_STREAM_API_URL || "https://smajpihub.onrender.com/stream/creator-content", private readonly fetcher: typeof fetch = fetch) {}
  async listContent() {
    return catalogRows(await catalogJson(this.sourceUrl, this.fetcher), "videos").map(row => ({ id: String(row._id || row.id), title: String(row.title).slice(0, 180), creatorName: typeof row.creatorName === "string" ? row.creatorName.slice(0, 180) : "", category: typeof row.category === "string" ? row.category.slice(0, 100) : "" }));
  }
}
