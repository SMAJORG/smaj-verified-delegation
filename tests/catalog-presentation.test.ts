import test from "node:test";
import assert from "node:assert/strict";
import { SmajStoreReadAdapter } from "@/src/server/store-adapter";
import { SmajJobsReadAdapter } from "@/src/server/jobs-adapter";
import { SmajStreamReadAdapter } from "@/src/server/stream-adapter";
import { listingUrl, publicImage } from "@/src/domain/catalog-links";

test("Store keeps backend images, currency prices and exact product links without inferring verification",async()=>{
  const adapter=new SmajStoreReadAdapter(undefined,async input=>{
    const url=new URL(String(input));assert.equal(url.searchParams.get("currency"),"USD");assert.equal(url.searchParams.get("maxPrice"),"3000");
    return Response.json({products:[{_id:"0123456789abcdef01234567",title:"Motorcycle",pricePi:4,priceUsdt:2800,description:"Actual backend description",sellerName:"Backend Seller",sellerVerified:true,images:["https://cdn.example/actual-bike.jpg"]},{_id:"other",title:"Unconfirmed listing",priceUsdt:2900,sellerName:"Other Seller",verificationStatus:"approved",verificationLevel:"seller_verified"},{_id:"over-budget",title:"Expensive bike",priceUsdt:4000,pricePi:1}]});
  });
  const records=await adapter.listProducts({search:"motorcycle",currency:"USD",maxPrice:3000});
  assert.equal(records.length,2);assert.equal(records[0].url,"https://smajpihub.com/product/0123456789abcdef01234567");assert.equal(records[0].imageUrl,"https://cdn.example/actual-bike.jpg");assert.equal(records[0].price,"$2,800 USDT reference");assert.equal(records[0].pricePi,4);assert.equal(records[0].summary,"Actual backend description");assert.equal(records[0].sellerVerified,true);assert.equal(records[1].sellerVerified,false);
});
test("Jobs and Stream detail links use actual backend identities and reject unsafe media URLs",async()=>{
  const jobs=await new SmajJobsReadAdapter(undefined,async()=>Response.json({jobs:[{_id:"db-id",slug:"backend-role",title:"Engineer",employerId:"real-employer",companyLogo:"https://cdn.example/employer.jpg"}]})).listJobs();
  assert.equal(jobs[0].url,"https://smajpihub.com/services/jobs/job/backend-role");
  const videos=await new SmajStreamReadAdapter(undefined,async()=>Response.json({videos:[{_id:"content-id",title:"Published video",cloudflareUid:"playback-uid",thumbnailUrl:"https://cdn.example/video.jpg"},{_id:"no-playback",title:"Metadata only"}]})).listContent();
  assert.equal(videos[0].url,"https://smajpihub.com/app/services/stream/watch/playback-uid");assert.equal(videos[1].url,undefined);
  assert.equal(publicImage("javascript:alert(1)"),undefined);assert.equal(publicImage("https://user:pass@evil.example/a"),undefined);assert.equal(publicImage("data:image/png;base64,fake"),undefined);assert.equal(listingUrl("unsupported","a"),undefined);
});
