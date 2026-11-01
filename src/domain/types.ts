export type JobsApiJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  mode: string;
  salary: string;
  category: string;
  summary: string;
  skills: string[];
};

export type JobRecommendation = {
  jobId: string;
  score: number;
  rationale: string;
  coverNote: string;
};

export type JobsPlan = {
  summary: string;
  recommendations: JobRecommendation[];
  model: string;
};

export type CreateDelegationInput = {
  goal: string;
  candidateName: string;
  skills: string[];
  maxApplications?: number;
};

export type StoreApiProduct = {
  pricePi?: number;
  priceUsdt?: number;
  quantity?: number;
  id: string;
  title: string;
  category: string;
  price: string;
  sellerName: string;
  location: string;
  summary: string;
};
