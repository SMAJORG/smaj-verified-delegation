import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import CatalogResultCard from "@/components/CatalogResultCard";
import LiveTaskResult from "@/components/LiveTaskResult";

test("result cards show backend data and canonical product pages; unconfirmed sellers receive no badge",()=>{
 const record={id:"0123456789abcdef01234567",title:"Motorcycle",price:"$2,800 USDT reference",sellerName:"Backend Seller",sellerVerified:true,imageUrl:"https://cdn.example/bike.jpg",summary:"Backend product description"};
 const markup=renderToStaticMarkup(createElement(CatalogResultCard,{service:"store",record}));
 assert.match(markup,/https:\/\/smajpihub.com\/product\/0123456789abcdef01234567/);assert.match(markup,/View Product/);assert.match(markup,/bike.jpg/);assert.match(markup,/\$2,800/);assert.match(markup,/Verified Seller/);
 const unconfirmed=renderToStaticMarkup(createElement(CatalogResultCard,{service:"store",record:{...record,sellerVerified:false}}));assert.doesNotMatch(unconfirmed,/Verified Seller/);
});
test("compact approval separates searches from binding actions and preserves cancellation",()=>{
 const task={id:"task",task:"Search SMAJ Store for motorcycles under $3,000.",createdAt:new Date().toISOString(),plan:{summary:"Fixture provider plan",model:"fixture",services:["store" as const],steps:[],warnings:[]}};
 const props={task,busy:false,discover:()=>{},cancel:()=>{},approve:()=>{}};
 const markup=renderToStaticMarkup(createElement(LiveTaskResult,props));assert.match(markup,/SMAJ AI needs your permission/);assert.match(markup,/Approve &amp; Search/);assert.match(markup,/>Cancel</);assert.doesNotMatch(markup,/<textarea|<form/);
 const bindingTask={...task,plan:{...task.plan,proposedActions:[{id:"apply",serviceId:"jobs" as const,kind:"apply" as const,recordId:"role",title:"Submit reviewed application",coverNote:"Reviewed draft"}]}};
 const binding=renderToStaticMarkup(createElement(LiveTaskResult,{...props,task:bindingTask}));assert.match(binding,/Review supported actions/);assert.match(binding,/Approve 0 actions/);assert.match(binding,/disabled=""/);
});
