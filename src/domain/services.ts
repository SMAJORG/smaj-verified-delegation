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
  { id: "store", name: "SMAJ Store", shortName: "Store", description: "Products and verified stores", platformStatus: "live", adapterMode: "connected", capabilities: ["product discovery", "price comparison"], example: "Compare products that fit my budget", accent: "#7c3aed" },
  { id: "stream", name: "SMAJ Stream", shortName: "Stream", description: "Movies, series, and entertainment", platformStatus: "live", adapterMode: "planning_only", capabilities: ["content discovery", "watch planning"], example: "Build a weekend watchlist", accent: "#db2777" },
  { id: "jobs", name: "SMAJ Jobs", shortName: "Jobs", description: "Jobs and freelance opportunities", platformStatus: "live", adapterMode: "connected", capabilities: ["read opportunities", "match roles", "mock applications"], example: "Find matching jobs and prepare applications", accent: "#6d28d9" },
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
  { id: "swap", name: "SMAJ Swap", shortName: "Swap", description: "Token swap planning", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["swap education", "risk review"], example: "Explain a swap without executing it", accent: "#0d9488" },
  { id: "token", name: "SMAJ Token", shortName: "Token", description: "Rewards and loyalty utility", platformStatus: "in_progress", adapterMode: "planning_only", capabilities: ["reward discovery", "loyalty planning"], example: "Explain available reward pathways", accent: "#d97706" },
] as const;

export const SERVICE_IDS = new Set<ServiceId>(SMAJ_SERVICES.map(service => service.id));

export type ServicePlanStep = {
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
  summary: string;
  model: "muse-spark-1.3";
  services: ServiceId[];
  steps: ServicePlanStep[];
  warnings: string[];
};
