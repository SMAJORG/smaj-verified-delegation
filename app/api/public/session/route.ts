import { NextRequest, NextResponse } from "next/server";
import { requireActorSession, SESSION_COOKIE, ssoConfigured } from "@/src/server/auth";
import { issuePublicSession } from "@/src/server/public-access";
import { apiError, requireSameOrigin } from "@/src/server/http";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 try{
  requireSameOrigin(request);
  let existing;try{existing=requireActorSession(request);}catch{/* A visitor needs no identity credentials. */}
  if(existing&&!existing.sandbox)return NextResponse.json({authenticated:existing.authType!=="public",publicAccess:existing.authType==="public",authType:existing.authType,sandbox:false,expiresAt:existing.expiresAt,ssoEnabled:ssoConfigured(),sampleTasksEnabled:false},{headers:{"Cache-Control":"no-store"}});
  const visitor=issuePublicSession(request);
  const response=NextResponse.json({authenticated:false,publicAccess:true,authType:"public",sandbox:false,expiresAt:visitor.expiresAt,ssoEnabled:ssoConfigured(),sampleTasksEnabled:false},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(SESSION_COOKIE,visitor.value,{httpOnly:true,sameSite:"lax",secure:request.nextUrl.protocol==="https:"||request.headers.get("x-forwarded-proto")?.split(",")[0].trim()==="https",path:"/",maxAge:visitor.maxAge});
  return response;
 }catch(error){const response=apiError(error);if(response.status===429)response.headers.set("Retry-After","60");return response;}
}
