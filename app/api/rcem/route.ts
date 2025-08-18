import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cache = { ts:number; value:any };
const LONG_TTL = 6 * 60 * 60 * 1000; // 6h
let cache: Cache | null = null;

function parseRCEmFromHtml(html:string){
  // VERY lightweight parser: look for YYYY-MM and number patterns around "PLN/MWh"
  const rows: { month:string; rcem_pln_mwh:number }[] = [];
  const re = /(\d{4})\s*[-.\/]\s*(\d{1,2}).{0,40}?([\d\s.,]+)\s*PLN\/MWh/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))){
    const y = m[1];
    const mm = m[2].padStart(2,"0");
    const num = Number(m[3].replace(/\s/g,"").replace(",", "."));
    if (Number.isFinite(num)){
      rows.push({ month: `${y}-${mm}`, rcem_pln_mwh: num });
    }
  }
  // de-duplicate by month, keep first occurrence
  const map = new Map<string,number>();
  for (const r of rows){
    if (!map.has(r.month)) map.set(r.month, r.rcem_pln_mwh);
  }
  const dedup = Array.from(map.entries()).map(([month, rcem_pln_mwh]) => ({ month, rcem_pln_mwh }));
  // sort desc
  dedup.sort((a,b)=> b.month.localeCompare(a.month));
  return dedup;
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const now = Date.now();
  if (cache && now - cache.ts < LONG_TTL) return NextResponse.json(cache.value);

  const page = await fetch("https://www.pse.pl/oire/rcem-rynkowa-miesieczna-cena-energii-elektrycznej", { cache: "no-store" as any });
  if (!page.ok) return NextResponse.json({ ok:false, error: "PSE RCEm fetch failed", status: page.status }, { status: 200 });
  const html = await page.text();
  const rows = parseRCEmFromHtml(html);
  const latest = rows[0] || null;

  const payload = { ok:true, rows, current_month_rcem_pln_mwh: latest?.rcem_pln_mwh, current_month: latest?.month };
  cache = { ts: now, value: payload };
  return NextResponse.json(payload);
}
