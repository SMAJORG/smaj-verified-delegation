import { NextResponse } from "next/server";
export const runtime = "nodejs";
const retired = () => NextResponse.json({ error: "endpoint_retired", message: "This endpoint has been retired. Sign in through SMAJ PI HUB and use /api/tasks for live requests." }, { status: 410, headers: { "Cache-Control": "no-store" } });
export const GET = retired;
