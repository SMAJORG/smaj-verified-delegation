import type { CatalogQuery } from "@/src/domain/services";
import { catalogJson, catalogRows, catalogSearchUrl, isCarSearch } from "@/src/server/catalog-http";
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

  async listProducts(query: CatalogQuery = {}): Promise<StoreApiProduct[]> {
    const rows = catalogRows(await catalogJson(catalogSearchUrl(this.sourceUrl, query, "store"), this.fetcher), "products");

    return rows.filter(product => {
      if (product.isDemo === true) return false;
      if (isCarSearch(query)) {
        const title = text(product.title, text(product.name));
        const evidence = `${title} ${text(product.description)} ${text(product.summary)}`;
        if (/\b(?:motorcycles?|motorbikes?|bikes?|scooters?|covers?|accessories|parts?|tires?|tyres?|mats?|chargers?|toys?)\b/i.test(title)) return false;
        if (!/\b(?:cars?|automobiles?|sedan|suv|hatchback|coupe|convertible|pickup|saloon|crossover|lexus|toyota|honda|bmw|mercedes|ford|nissan|hyundai|kia|volkswagen|audi|tesla)\b/i.test(evidence)) return false;
      }
      if (query.maxPrice === undefined || !query.currency) return true;
      const value = product[query.currency === "USD" ? "priceUsdt" : "pricePi"];
      return value !== undefined && value !== null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= query.maxPrice;
    }).map(product => ({
      id: text(product._id, text(product.id, text(product.slug))),
      title: text(product.title, text(product.name, "Untitled product")),
      category: text(product.category, "Other"),
      price: query.currency === "USD" && product.priceUsdt != null ? `$${Number(product.priceUsdt).toLocaleString("en-US")}` : price(product),
      imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : typeof product.image === "string" ? product.image : Array.isArray(product.images) && typeof product.images[0] === "string" ? product.images[0] : undefined,
      pricePi: Number.isFinite(Number(product.pricePi)) ? Number(product.pricePi) : undefined,
      priceUsdt: Number.isFinite(Number(product.priceUsdt)) ? Number(product.priceUsdt) : undefined,
      quantity: Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : undefined,
      sellerName: text(product.sellerName, "SMAJ Store seller"),
      location: text(product.location, text(product.country, "Not specified")),
      summary: text(product.description, text(product.summary, "No description provided.")).slice(0, 500),
    }));
  }
}