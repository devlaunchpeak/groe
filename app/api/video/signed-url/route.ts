import { NextResponse } from "next/server";

// Prompt 14: Returns a short-lived signed URL for a video asset.
// Raw asset IDs are never exposed to the client (rule 4.2).
// Authentication + asset ownership verified server-side before signing.
export async function GET() {
  // TODO (Prompt 14): validate session, look up asset, call video vendor SDK, return signed URL
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
