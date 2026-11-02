import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LiveTaskResult from "@/components/LiveTaskResult";
import type { AiTask } from "@/src/server/ai-tasks";

const renderResult = (record: Record<string, unknown>, additionalRecords: Record<string, unknown>[] = []) => {
  const task: AiTask = {
    id: "store-result",
    task: "Find a product",
    createdAt: new Date(0).toISOString(),
    plan: {
      model: "fixture",
      summary: "A matching product was found.",
      services: ["store"],
      steps: [],
      warnings: [],
      discovery: {
        approvedAt: new Date(0).toISOString(),
        completedAt: new Date(0).toISOString(),
        results: [{ serviceId: "store", source: "fixture", status: "read", records: [record, ...additionalRecords] }],
        proofHash: "fixture",
      },
    },
  };
  return renderToStaticMarkup(createElement(LiveTaskResult, {
    task,
    busy: false,
    sandbox: false,
    approve: () => {},
    retry: () => {},
    reportError: () => {},
  }));
};

test("Store results render image-first product details, concise expandable descriptions and a visible product link", () => {
  const html = renderResult({
    id: "product-1",
    title: "Desk lamp",
    price: "$25 USDT",
    sellerName: "Amina's Store",
    location: "Lagos",
    imageUrl: "https://images.example/lamp.jpg",
    summary: "A well-made desk lamp with a sturdy adjustable arm and several useful features for your workspace. This description is long enough to make sure the complete catalog information remains available behind the read more control.",
  });
  const imagePosition = html.indexOf("taskThumb");
  const titlePosition = html.indexOf("Desk lamp");
  const descriptionPosition = html.indexOf("taskDescriptionClamp");
  assert.ok(imagePosition >= 0 && imagePosition < titlePosition && titlePosition < descriptionPosition);
  assert.ok(html.includes("$25 USDT"));
  assert.match(html, /Seller: Amina&#x27;s Store|Seller: Amina's Store/);
  assert.match(html, /Location: Lagos/);
  assert.match(html, /aria-expanded="false"/);
  assert.ok(html.includes(">Read more</button>"));
  assert.match(html, /View product/);
});

test("Store result labels missing seller, location and price instead of filling in product facts", () => {
  const html = renderResult({ id: "product-2", title: "Unpriced item" });
  assert.match(html, /Price not listed/);
  assert.match(html, /Seller: Not listed/);
  assert.match(html, /Location: Not listed/);
  assert.match(html, /class="taskResultCards taskResultCarousel taskResultCarouselSingle"/);
  assert.doesNotMatch(html, /role="region"/);
});

test("multiple connected-service results render in a keyboard-accessible horizontal carousel region", () => {
  const html = renderResult(
    { id: "product-1", title: "First product" },
    [{ id: "product-2", title: "Second product" }],
  );
  assert.match(html, /class="taskResultCards taskResultCarousel" role="region" aria-label="store results" tabindex="0"/);
  assert.ok(html.indexOf("First product") < html.indexOf("Second product"));
});
