import type { StoreApiProduct } from "@/src/domain/types";

export const DEFAULT_STORE_URL = "https://smajpihub.onrender.com/marketplace/products";

type StoreResponse = { products?: Array<Record<string, unknown>> };

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
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
    const response = await this.fetcher(this.sourceUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`SMAJ Store read failed with HTTP ${response.status}`);
    const body = (await response.json()) as StoreResponse;
    if (!Array.isArray(body.products)) throw new Error("SMAJ Store returned an invalid payload");

    return body.products.map((product, index) => ({
      id: text(product._id, text(product.id, `product-${index + 1}`)),
      title: text(product.title, text(product.name, "Untitled product")),
      category: text(product.category, "Other"),
      price: price(product),
      sellerName: text(product.sellerName, "SMAJ Store seller"),
      location: text(product.location, text(product.country, "Not specified")),
      summary: text(product.description, text(product.summary, "No description provided.")).slice(0, 500),
    }));
  }
}