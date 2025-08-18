import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toISO(d: Date){ return d.toISOString().slice(0,10); }

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const mode = url.searchParams.get("mode") || "rce";

  if(!from || !to) return NextResponse.json({ error: "from/to required" }, { status: 400 });

  const start = new Date(from + "T00:00:00Z");
  const end   = new Date(to   + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  if (end < start) return NextResponse.json({ error: "to before from" }, { status: 400 });

  let kwhSum = 0;
  let plnSum = 0;
  const oneDay = 86400000;

  for (let t = start.getTime(); t <= end.getTime(); t += oneDay){
    const day = toISO(new Date(t));
    // Use our "summary/day" and "revenue/day" endpoints; they can internally cache FoxESS for 30s
    const [sum, rev] = await Promise.all([
      j(`/api/foxess/summary/day?date=${day}`),
      j(`/api/revenue/day?date=${day}&mode=${mode}`),
    ]);
    const kwh = Number(sum?.today?.generation?.total ?? 0);
    const pln = Number(rev?.totals?.revenue_pln ?? 0);
    if (Number.isFinite(kwh)) kwhSum += kwh;
    if (Number.isFinite(pln)) plnSum += pln;
  }

  return NextResponse.json({ ok: true, from, to, mode, kwh: Number(kwhSum.toFixed(1)), pln: Number(plnSum.toFixed(2)) });
}
