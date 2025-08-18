import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

type Cache = { ts: number; data: any };
const TTL_MS = 30_000;
let mem: Cache | null = null;

async function tryFetch(url: string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return j;
}

export async function GET() {
  const now = Date.now();
  // serve cached if fresh
  if (mem && now - mem.ts < TTL_MS) return NextResponse.json(mem.data);

  const candidates = [
    process.env.FOXESS_REALTIME_URL,
    "/api/foxess?mode=realtime",
    "/api/foxess",
    "/api/foxess/debug/realtime",
    "/api/foxess/debug/realtime-now",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      const j = await tryFetch(c);
      if (j && j.pvNowW != null) {
        mem = { ts: now, data: j };
        return NextResponse.json(j);
      }
    } catch {}
  }
  // No data: don't cache nulls; return 404 so client can fall back elsewhere
  return NextResponse.json({ ok:false, pvNowW:null }, { status: 404 });
}
