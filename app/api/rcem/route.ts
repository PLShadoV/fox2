import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cache = { ts:number; value:any };
const LONG_TTL = 6 * 60 * 60 * 1000; // 6h
let cache: Cache | null = null;

function parseRCEmFromHtml(html:string){
  const rows: { month:string; rcem_pln_mwh:number }[] = [];
  // Wzorce z przecinkami/kropkami i różnymi separatorami
  const re = /(\d{4})\s*[-./]\s*(\d{1,2})[^0-9]{0,40}?([\d\s.,]+)\s*PLN\/MWh/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))){
    const y = m[1];
    const mm = m[2].padStart(2,"0");
    const num = Number(m[3].replace(/\s/g,"").replace(",", "."));
    if (Number.isFinite(num)){
      rows.push({ month: `${y}-${mm}`, rcem_pln_mwh: num });
    }
  }
  // deduplikacja + sort
  const map = new Map<string,number>();
  for (const r of rows) if (!map.has(r.month)) map.set(r.month, r.rcem_pln_mwh);
  const dedup = Array.from(map.entries()).map(([month, rcem_pln_mwh]) => ({ month, rcem_pln_mwh }));
  dedup.sort((a,b)=> b.month.localeCompare(a.month));
  return dedup;
}

async function computeMonthAvgFromRCE(origin:string, ym:string){
  const r = await fetch(`${origin}/api/rce/month-avg?date=${ym}-01`, { cache: "no-store" as any });
  if (!r.ok) return null;
  const j = await r.json();
  const v = Number(j?.rcem_pln_mwh ?? j?.avg ?? 0);
  if (!Number.isFinite(v) || v<=0) return null;
  return { month: ym.slice(0,7), rcem_pln_mwh: Number(v.toFixed(2)) };
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const origin = url.origin;
  const now = Date.now();
  if (cache && (now - cache.ts) < LONG_TTL) return NextResponse.json(cache.value);

  let rows: {month:string; rcem_pln_mwh:number}[] = [];
  let note: string | undefined = undefined;

  // 1) parsowanie PSE
  try{
    const page = await fetch("https://www.pse.pl/oire/rcem-rynkowa-miesieczna-cena-energii-elektrycznej", { cache: "no-store" as any });
    if (page.ok){
      const html = await page.text();
      rows = parseRCEmFromHtml(html);
    }
  }catch{ /* ignore */}

  // 2) fallback: policz średnie miesiące (ostatnie 12)
  if (rows.length === 0){
    note = "Brak danych z PSE – pokazuję średnie miesięczne wyliczone z godzinowego RCE.";
    const base = new Date();
    const out: {month:string; rcem_pln_mwh:number}[] = [];
    for (let i=0;i<12;i++){
      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth()-i, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
      const v = await computeMonthAvgFromRCE(origin, ym);
      if (v) out.push(v);
    }
    rows = out;
  }

  const payload = { ok:true, rows, note };
  cache = { ts: now, value: payload };
  return NextResponse.json(payload);
}
