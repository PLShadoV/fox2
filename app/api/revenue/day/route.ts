import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

function toISO(d: Date){ return d.toISOString().slice(0,10); }

// simple cache to reduce duplicate work here too
type Cache = { ts:number; value:any };
const TTL = 60 * 1000;
const mem: Record<string, Cache> = {};

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || toISO(new Date());
  const mode = (url.searchParams.get("mode") || "rce").toLowerCase(); // "rce" | "rcem"
  const key = `${date}:${mode}`;
  const now = Date.now();
  const hit = mem[key];
  if (hit && now - hit.ts < TTL) return NextResponse.json(hit.value);

  const origin = url.origin;

  // 1) generation series (cached proxy)
  const summary = await j(`${origin}/api/foxess/summary/day-cached?date=${date}`);
  const series: number[] = summary?.today?.generation?.series ?? [];
  const kwh24 = Array.from({length:24}, (_,h)=> Number(series[h] ?? 0));

  // 2) hourly RCE
  const rce = await j(`${origin}/api/rce?date=${date}`);
  const rceRows: Array<{timeISO:string;rce_pln_mwh:number}> = rce?.rows || rce?.data || rce || [];

  // 3) RCEm monthly avg from official table endpoint
  let rcem: number | null = null;
  if (mode === "rcem"){
    const m = await j(`${origin}/api/rcem?date=${date}`);
    rcem = Number(m?.current_month_rcem_pln_mwh ?? m?.rcem_pln_mwh ?? 0);
    if (!Number.isFinite(rcem)) rcem = 0;
  }

  const rows = [];
  let total = 0;
  for (let h=0; h<24; h++){
    const kwh = Number(kwh24[h] ?? 0);
    const price = Number(rceRows[h]?.rce_pln_mwh ?? 0);
    const priceUsed = mode === "rcem"
      ? Math.max(rcem ?? 0, 0)
      : Math.max(price, 0);
    const revenue = kwh * priceUsed / 1000;
    total += revenue;
    rows.push({
      hour: h,
      kwh,
      price_pln_mwh: price,
      price_used_pln_mwh: priceUsed,
      revenue_pln: Number(revenue.toFixed(2)),
    });
  }

  const payload = {
    ok: true,
    date,
    mode,
    rows,
    totals: { kwh: Number(kwh24.reduce((a,b)=>a+b,0).toFixed(1)), revenue_pln: Number(total.toFixed(2)) }
  };
  mem[key] = { ts: now, value: payload };
  return NextResponse.json(payload);
}
