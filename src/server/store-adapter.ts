import { catalogJson, catalogRows } from "@/src/server/catalog-http";
import type { StoreApiProduct } from "@/src/domain/types";

export const DEFAULT_STORE_URL = "https://smajpihub.onrender.com/marketplace/products";

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value.slice(0, 600) : fallback);
const price = (product: Record<string, unknown>) => {
  const pi = Number(product.pricePi);
  if (Number.isFinite(pi) && pi > 0) return `${pi} Pi`;
  const usdt = Number(product.priceUsdt);
  if (Number.isFinite(usdt) && usdt > 0) return `$${usdt}`;
  return "Price not specified";
};

// Read-only SMAJ Store adapter. It only performs GET requests against the
// public marketplace catalog; orders, checkout, and payments stay disabled.
export class SmajStoreReadAdapter {
  readonly sourceUrl: string;

  constructor(
    sourceUrl = process.env.SMAJ_STORE_API_URL || DEFAULT_STORE_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.sourceUrl = sourceUrl;
  }

  async listProducts(): Promise<StoreApiProduct[]> {
    const rows = catalogRows(await catalogJson(this.sourceUrl, this.fetcher), "products");

    return rows.map(product => ({
      id: text(product._id, text(product.id, text(product.slug))),
      title: text(product.title, text(product.name, "Untitled product")),
      category: text(product.category, "Other"),
      price: price(product),
      sellerName: text(product.sellerName, "SMAJ Store seller"),
      location: text(product.location, text(product.country, "Not specified")),
      summary: text(product.description, text(product.summary, "No description provided.")).slice(0, 500),
    }));
  }
}