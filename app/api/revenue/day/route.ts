import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

function toISO(d: Date){ return d.toISOString().slice(0,10); }

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || toISO(new Date());
  const mode = (url.searchParams.get("mode") || "rce").toLowerCase(); // "rce" | "rcem"
  const origin = url.origin;

  // 1) get generation series for day
  const summary = await j(`${origin}/api/foxess/summary/day?date=${date}`);
  const series: number[] = summary?.today?.generation?.series ?? [];
  const kwh24 = Array.from({length:24}, (_,h)=> Number(series[h] ?? 0));

  // 2) get hourly RCE for the day
  const rce = await j(`${origin}/api/rce?date=${date}`);
  const rceRows: Array<{timeISO:string;rce_pln_mwh:number}> = rce?.rows || rce?.data || rce || [];

  // 3) if RCEm: compute month average (non-negative)
  let rcem: number | null = null;
  if (mode === "rcem"){
    const m = await j(`${origin}/api/rce/month-avg?date=${date}`);
    rcem = Number(m?.rcem_pln_mwh);
    if (!Number.isFinite(rcem)) rcem = null;
  }

  const rows = [];
  let total = 0;
  for (let h=0; h<24; h++){
    const kwh = Number(kwh24[h] ?? 0);
    const price = Number(rceRows[h]?.rce_pln_mwh ?? 0);
    const priceUsed = mode === "rcem"
      ? (rcem ?? 0)
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

  return NextResponse.json({
    ok: true,
    date,
    mode,
    rows,
    totals: { kwh: Number(kwh24.reduce((a,b)=>a+b,0).toFixed(1)), revenue_pln: Number(total.toFixed(2)) }
  });
}
