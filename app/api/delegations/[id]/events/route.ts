import { NextRequest } from "next/server";
import { requireActor } from "@/src/server/auth";
import { apiError } from "@/src/server/http";
import { workspaceWorkflow } from "@/src/server/demo-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = requireActor(request);
    const { id } = await context.params;
    const workflow = workspaceWorkflow(request);
    workflow.get(id, actorId);
    const encoder = new TextEncoder();
    let lastEventId = 0;
    let interval: ReturnType<typeof setInterval>;
    const stream = new ReadableStream({
      start(controller) {
        const publish = () => {
          try {
            requireActor(request);
            const delegation = workflow.get(id, actorId);
            const newest = delegation.events.at(-1)?.id || 0;
            if (newest !== lastEventId) {
              lastEventId = newest;
              controller.enqueue(encoder.encode(`id: ${newest}\nevent: delegation\ndata: ${JSON.stringify(delegation)}\n\n`));
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(interval);
            controller.close();
          }
        };
        publish();
        interval = setInterval(publish, 350);
      },
      cancel() { clearInterval(interval); },
    });
    return new Response(stream, { headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive",
    } });
  } catch (error) { return apiError(error); }
}
