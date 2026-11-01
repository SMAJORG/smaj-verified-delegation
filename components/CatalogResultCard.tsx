"use client";
import { useState } from "react";
import { listingUrl, publicImage } from "@/src/domain/catalog-links";
export default function CatalogResultCard({service,record,reason}:{service:string;record:Record<string,unknown>;reason?:string}) {
  const [failedImage,setFailedImage]=useState(false);
  const image=publicImage(record.imageUrl);
  const canonical=listingUrl(service,String(record.id||""));
  const streamUrl=typeof record.url==="string"&&/^https:\/\/smajpihub\.com\/app\/services\/stream\/watch\/[a-zA-Z0-9_-]+$/.test(record.url)?record.url:undefined;
  const href=canonical||streamUrl;
  return <article className="catalogResult">
    {image&&!failedImage&&<img src={image} alt={String(record.title||"")} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailedImage(true)}/>}
    <div className="catalogResultBody"><h3>{String(record.title||"")}</h3>{record.price!=null&&<p className="catalogPrice">{String(record.price)}</p>}{service==="store"&&record.pricePi!=null&&<small>{String(record.pricePi)} Pi · {record.priceUsdt!=null?`${record.priceUsdt} USDT reference`:"No dollar reference supplied"}</small>}{Boolean(record.salary)&&<p>{String(record.salary)}</p>}
      {Boolean(record.sellerName)&&<p>Seller: {String(record.sellerName)}{record.sellerVerified===true&&<span className="verifiedSeller">Verified Seller</span>}</p>}
      {Boolean(record.company||record.creatorName)&&<p>{String(record.company||record.creatorName)}</p>}
      <p>{String(record.summary||record.description||"")}</p>{reason&&<p className="matchReason">{reason}</p>}
      {href&&<a className="secondaryButton" href={href} target="_blank" rel="noreferrer">{service==="store"?"View Product":service==="jobs"?"View Job":"View Content"}</a>}
    </div>
  </article>;
}
