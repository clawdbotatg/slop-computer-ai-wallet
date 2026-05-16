import { NextRequest, NextResponse } from "next/server";

// Slop fork: CV / clawdviction auth has been stripped. The fork runs inside
// live.slop.computer as an unmetered surface — Anthropic budget caps are the
// abuse limiter, not per-request signature verification.
//
// `requireAuth` is preserved as a function signature so route handlers don't
// have to change shape, but it always returns a passthrough { address } and
// never returns a NextResponse. The address is derived from:
//   1. `x-slop-address` header (set by the embedding parent in slop-computer)
//   2. `?address` query param
//   3. zero address fallback
// Downstream code that wants the "operating wallet" should read it from the
// request body / params explicitly — the auth address is informational only.

const ZERO = "0x0000000000000000000000000000000000000000";

export async function requireAuth(request: NextRequest): Promise<{ address: string } | NextResponse> {
  const headerAddr = request.headers.get("x-slop-address");
  const queryAddr = request.nextUrl?.searchParams?.get?.("address") ?? null;
  const address = (headerAddr || queryAddr || ZERO).toLowerCase();
  return { address };
}
