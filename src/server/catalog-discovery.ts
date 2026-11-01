import { AppError } from "@/src/server/http";
import { catalogSearchUrl } from "@/src/server/catalog-http";
import { createHash } from "node:crypto";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";
import { SmajStreamReadAdapter } from "@/src/server/stream-adapter";
import type { ServiceId, ServiceRoutePlan, ServicePlanStep } from "@/src/domain/services";

type CatalogResult=NonNullable<ServiceRoutePlan["discovery"]>["results"][number];
export async function discoverCatalogs(ids:ServiceId[],authorized:(id:ServiceId)=>boolean,steps:ServicePlanStep[]=[]) {
  const approvedAt=new Date().toISOString();
  const results=await Promise.all([...new Set(ids)].filter(id=>["jobs","store","stream"].includes(id)).map(async(id):Promise<CatalogResult>=>{
    if(!authorized(id))return {serviceId:id,source:"",status:"unavailable",records:[],error:"Service disconnected; no request sent"};
    let source="";
    try{
      const adapter=id==="jobs"?new SmajJobsReadAdapter():id==="store"?new SmajStoreReadAdapter():new SmajStreamReadAdapter();
      const query=steps.find(step=>step.serviceId===id)?.query;
      source=catalogSearchUrl(adapter.sourceUrl,query,id);
      const records=adapter instanceof SmajJobsReadAdapter?await adapter.listJobs(query):adapter instanceof SmajStoreReadAdapter?await adapter.listProducts(query):await adapter.listContent(query);
      if(!authorized(id))throw new AppError("service_disconnected","Service disconnected during read",409);
      return {serviceId:id,source,status:"read",records};
    }catch(error){return {serviceId:id,source,status:"unavailable",records:[],error:error instanceof AppError?error.message:"Catalog unavailable or invalid; check backend deployment and configuration"};}
  }));
  const proof={approvedAt,completedAt:new Date().toISOString(),results};
  return {...proof,proofHash:createHash("sha256").update(JSON.stringify(proof)).digest("hex")};
}
