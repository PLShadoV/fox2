import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const candidates = [
    process.env.FOXESS_REALTIME_URL,
    "/api/foxess?mode=realtime",
    "/api/foxess",
    "/api/foxess/debug/realtime",
    "/api/foxess/debug/realtime-now",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      const r = await fetch(c, { cache:"no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.pvNowW != null) return NextResponse.json(j);
        // otherwise continue trying other candidates
      }
    } catch {}
  }
  // Return 404 so the client tryMany continues to other paths
  return NextResponse.json({ ok:false, pvNowW:null }, { status: 404 });
}
