export type ServiceId = "store" | "stream" | "jobs" | "education" | "sports" | "food" | "health" | "transport" | "agro" | "energy" | "charity" | "housing" | "events" | "swap" | "token";
export type PlatformStatus = "live" | "coming_soon" | "in_progress";
export type AdapterMode = "connected" | "planning_only";

export type SmajService = {
  id: ServiceId;
  name: string;
  shortName: string;
  description: string;
  platformStatus: PlatformStatus;
  adapterMode: AdapterMode;
  capabilities: string[];
  example: string;
  accent: string;
};

export const SMAJ_SERVICES: readonly SmajService[] = [
  { id: "store", name: "SMAJ Store", shortName: "Store", description: "Products, seller messaging, and order preparation", platformStatus: "live", adapterMode: "connected", capabilities: ["product discovery", "price comparison", "contact a seller with approval", "prepare an order with approval"], example: "Find a product and ask its seller if it is available", accent: "#7c3aed" },
  { id: "stream", name: "SMAJ Stream", shortName: "Stream", description: "Published public creator content", platformStatus: "live", adapterMode: "connected", capabilities: ["content discovery", "watch planning"], example: "Build a weekend watchlist", accent: "#db2777" },
  { id: "jobs", name: "SMAJ Jobs", shortName: "Jobs", description: "Jobs, verified employer listings, and approved applications", platformStatus: "live", adapterMode: "connected", capabilities: ["read opportunities", "match roles", "prepare applications", "submit an application after approval"], example: "Find matching jobs and prepare applications", accent: "#6d28d9" },
  { id: "education", name: "SMAJ Education", shortName: "Education", description: "Courses and practical skills", platformStatus: "coming_soon", adapterMode: "planning_only", capabilities: ["learning plans", "course discovery"], example: "Create a learning path for product design", accent: "#2563eb" },
  { id: "sports", name: "SMAJ Sports", shortName: "Sports", description: "Sports, fixtures, and scores", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["fixture planning", "sports summaries"], example: "Plan which matches to follow this week", accent: "#ea580c" },
  { id: "food", name: "SMAJ Food", shortName: "Food", description: "Restaurants and food delivery", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["meal planning", "restaurant discovery"], example: "Plan affordable meals near me", accent: "#dc2626" },
  { id: "health", name: "SMAJ Health", shortName: "Health", description: "Doctors and appointments", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["appointment preparation", "provider discovery"], example: "Prepare questions for a doctor visit", accent: "#059669" },
  { id: "transport", name: "SMAJ Transport", shortName: "Transport", description: "Rides and transport planning", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["route planning", "ride preparation"], example: "Plan transport for my appointments", accent: "#0891b2" },
  { id: "agro", name: "SMAJ Agro", shortName: "Agro", description: "Farmers, crops, and markets", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["crop planning", "market discovery"], example: "Create a crop-to-market checklist", accent: "#65a30d" },
  { id: "energy", name: "SMAJ Energy", shortName: "Energy", description: "Energy and utility services", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["usage planning", "utility preparation"], example: "Create an energy-saving plan", accent: "#ca8a04" },
  { id: "charity", name: "SMAJ Charity", shortName: "Charity", description: "Donations and verified causes", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["cause discovery", "donation planning"], example: "Help me assess causes before donating", accent: "#e11d48" },
  { id: "housing", name: "SMAJ Housing", shortName: "Housing", description: "Properties and rentals", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["property discovery", "rental checklists"], example: "Prepare a safe rental search", accent: "#4f46e5" },
  { id: "events", name: "SMAJ Events", shortName: "Events", description: "Events and tickets", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["event discovery", "attendance planning"], example: "Plan events for my weekend", accent: "#9333ea" },
  { id: "swap", name: "SMAJ Swap", shortName: "Swap", description: "Planned second-hand trading and peer-to-peer exchange", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["exchange education", "risk review"], example: "Explain the White Paper’s peer-to-peer exchange vision", accent: "#0d9488" },
  { id: "token", name: "SMAJ Token", shortName: "Token", description: "Deferred concept outside the current launch plan", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["reward discovery", "loyalty planning"], example: "Explain available reward pathways", accent: "#d97706" },
] as const;

export const SERVICE_IDS = new Set<ServiceId>(SMAJ_SERVICES.map(service => service.id));

export type CatalogQuery = { search?: string; category?: string; maxPrice?: number; currency?: "USD" | "PI" };
export type ModelEvidence = { provider: "meta"; model: string; responseId: string | null; receivedAt: string };
export type JobApplicationPreview = {
  detailsHash: string;
  job: { recordId: string; title: string; company: string; location: string; type: string; mode: string; salary: string; category: string };
  profile: { title: string; skills: string[]; location: string; portfolio: string; summary: string; profilePhoto: string };
  cv: { attached: boolean; name?: string; size?: number; visibility?: string };
};
export type StoreActionPreview = {
  product: { recordId: string; sellerId: string; title: string; sellerName: string; pricePi: number; quantityAvailable: number };
};
export type StoreMessageEvidence = {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
};
export type LiveAction =
  | { id: string; serviceId: "jobs"; recordId: string; kind: "apply"; title: string; coverNote: string; applicationPreview?: JobApplicationPreview }
  | { id: string; serviceId: "store"; recordId: string; kind: "save_product"; title: string }
  | { id: string; serviceId: "store"; recordId: string; kind: "contact_seller"; title: string; message: string; storePreview?: StoreActionPreview }
  | { id: string; serviceId: "store"; recordId: string; kind: "create_order"; title: string; quantity: number; storePreview?: StoreActionPreview };
export type LiveExecution = { status: "queued" | "running" | "retrying" | "verified" | "failed"; approvedAt: string; expiresAt: string; actions: LiveAction[]; attempts: number; error?: string; retryable?: boolean; evidence?: unknown[]; events?: Array<{ at: string; type: string; message: string }>; receipt?: { mode: "live"; verifiedAt: string; evidence: unknown[]; proofHash: string; proof: unknown } };

export type ServicePlanStep = {
  query?: CatalogQuery;
  id: string;
  serviceId: ServiceId;
  title: string;
  description: string;
  capability: string;
  status: "ready" | "approval_required" | "unavailable";
  approvalRequired: boolean;
  reason: string;
};

export type ServiceRoutePlan = {
  generationStatus?: "pending" | "failed" | "complete";
  generationError?: string;
  ai?: ModelEvidence;
  summaryAi?: ModelEvidence;
  summaryError?: { code: string; message: string };
  selectedStoreProduct?: { id: string; sellerId?: string; title: string; sellerName?: string; pricePi?: number; priceUsdt?: number; quantity?: number; summary?: string };
  matches?: Array<{ serviceId: string; id: string; reason: string }>;
  proposedActions?: LiveAction[];
  actionReviewHash?: string;
  execution?: LiveExecution;
  sources?: Array<{ id: string; title: string; url: string; file: string }>;
  discovery?: { approvedAt: string; completedAt: string; results: Array<{ serviceId: string; source: string; status: "read" | "unavailable"; records: unknown[]; error?: string }>; proofHash: string };
  summary: string;
  model: string;
  services: ServiceId[];
  steps: ServicePlanStep[];
  warnings: string[];
};
