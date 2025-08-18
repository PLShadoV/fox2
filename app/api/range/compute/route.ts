import { NextRequest, NextResponse } from "next/server";

type Mode = "rce" | "rcem";

function isIsoDate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function addDaysISO(iso: string, delta: number){
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0,10);
}

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  // For range compute we tolerate 404/500 by returning null to keep going
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");
  const modeQ = (url.searchParams.get("mode") as Mode) || "rce";
  if (!isIsoDate(fromQ) || !isIsoDate(toQ)) {
    return NextResponse.json({ ok:false, error:"from/to must be YYYY-MM-DD" }, { status: 400 });
  }
  // Build origin for absolute API calls (works on serverless)
  const origin = url.origin;

  const rows: Array<{date:string;kwh:number;revenue_pln:number}> = [];
  let cursor = fromQ!;
  let sumKWh = 0, sumPLN = 0;

  while (true){
    const date = cursor;
    // 1) generation for the day
    const summary = await j(`${origin}/api/foxess/summary/day-cached?date=${date}`);
    const series: number[] = summary?.today?.generation?.series ?? [];
    const kwh24 = Array.from({length:24}, (_,h)=> Number(series[h] ?? 0));
    const totalKWh = kwh24.reduce((a,b)=>a + (Number.isFinite(b)?b:0), 0);

    // 2) price logic
    let revenue = 0;
    if (modeQ === "rce"){
      const rce = await j(`${origin}/api/rce?date=${date}`);
      const rceRows: Array<{timeISO:string;rce_pln_mwh:number}> = rce?.rows || rce?.data || [];
      for (let h=0; h<24; h++){
        const price = Number(rceRows[h]?.rce_pln_mwh ?? 0);
        const used = Math.max(price, 0);
        const kwh = Number(kwh24[h] ?? 0);
        revenue += kwh * used / 1000;
      }
    } else {
      // RCEm: multiply daily total by official monthly price
      const r = await j(`${origin}/api/rcem?date=${date}`);
      let price = Number(r?.rcem_pln_mwh ?? r?.current_month_rcem_pln_mwh ?? 0);
      if (!Number.isFinite(price)) price = 0;
      price = Math.max(price, 0);
      revenue = totalKWh * price / 1000;
    }

    rows.push({ date, kwh: Number(totalKWh.toFixed(2)), revenue_pln: Number(revenue.toFixed(2)) });
    sumKWh += totalKWh;
    sumPLN += revenue;

    if (date === toQ) break;
    cursor = addDaysISO(cursor, 1);
  }

  return NextResponse.json({
    ok: true,
    mode: modeQ,
    from: fromQ,
    to: toQ,
    sum: { kwh: Number(sumKWh.toFixed(2)), revenue_pln: Number(sumPLN.toFixed(2)) },
    rows
  }, { status: 200 });
}
