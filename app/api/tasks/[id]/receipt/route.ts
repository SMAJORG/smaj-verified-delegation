import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/src/server/auth";
import { workspaceDatabase } from "@/src/server/workspace";
import { AiTaskStore } from "@/src/server/ai-tasks";
import { genuineReceipt, receiptPdf } from "@/src/server/proof-receipt";
import { apiError, AppError } from "@/src/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{id:string}> }) {
  try {
    const owner=requireActor(request);const task=new AiTaskStore(workspaceDatabase(request)).get(owner,(await context.params).id);
    const receipt=genuineReceipt(task,owner);const format=request.nextUrl.searchParams.get("format")||"json";
    if(!["pdf","json"].includes(format))throw new AppError("invalid_format","Choose PDF or JSON",400);
    const headers={"Cache-Control":"no-store","Content-Disposition":`attachment; filename="smaj-proof-${task.id}.${format}"`};
    return format==="pdf" ? new NextResponse(Buffer.from(receiptPdf(receipt)),{headers:{...headers,"Content-Type":"application/pdf"}}) : NextResponse.json(receipt,{headers});
  }catch(error){return apiError(error);}
}
