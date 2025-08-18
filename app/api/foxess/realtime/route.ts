import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Optional: allow overriding realtime source from env
  const url = process.env.FOXESS_REALTIME_URL;
  const candidates = [
    url,
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
        return NextResponse.json(j);
      }
    } catch {}
  }
  // Friendly fallback – avoid 404 to keep UI calm; return null pv
  return NextResponse.json({ pvNowW: null, ok: true }, { status: 200 });
}
