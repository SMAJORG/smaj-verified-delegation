import { listingUrl, publicImage } from "@/src/domain/catalog-links";
import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows, catalogSearchUrl } from "@/src/server/catalog-http";
import type { StoreApiProduct } from "@/src/domain/types";

export const DEFAULT_STORE_URL = "https://smajpihub.onrender.com/marketplace/products";

const text = (value: unknown, fallback = "") => (typeof value === "string" ? value.slice(0, 600) : fallback);
const optionalNumber = (value: unknown) => value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : undefined;
const price = (product: Record<string, unknown>, currency?: string) => {
  const reference = Number(product.priceUsdt);
  if (currency === "USD" && Number.isFinite(reference) && reference > 0) return `$${reference.toLocaleString("en-US")} USDT reference`;
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

  async listProducts(query: CatalogQuery = {}): Promise<StoreApiProduct[]> {
    const rows = catalogRows(await catalogJson(catalogSearchUrl(this.sourceUrl, query, "store"), this.fetcher), "products");

    return rows.filter(product => {
      if (query.maxPrice === undefined || !query.currency) return true;
      const value = product[query.currency === "USD" ? "priceUsdt" : "pricePi"];
      return value !== undefined && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= query.maxPrice;
    }).map(product => ({
      id: text(product._id, text(product.id, text(product.slug))),
      title: text(product.title, text(product.name, "Untitled product")),
      url: listingUrl("store", text(product._id, text(product.id, text(product.slug)))),
      imageUrl: publicImage((Array.isArray(product.images) ? product.images.find(image => typeof image === "string" && image.trim()) : undefined) || product.image),
      sellerVerified: product.sellerVerified === true,
      category: text(product.category, "Other"),
      price: price(product, query.currency),
      pricePi: optionalNumber(product.pricePi),
      priceUsdt: optionalNumber(product.priceUsdt),
      quantity: optionalNumber(product.quantity),
      sellerName: text(product.sellerName),
      location: text(product.location, text(product.country, "Not specified")),
      summary: text(product.description, text(product.summary, "No description provided.")).slice(0, 500),
    }));
  }
}