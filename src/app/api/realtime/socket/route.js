import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Use external Node adapter for persistent Socket.IO in production.",
  });
}
