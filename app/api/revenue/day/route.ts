import { NextRequest, NextResponse } from "next/server";
import { foxReportQueryDay } from "@/lib/foxess";

function sum(arr: number[]) { return arr.reduce((a,b)=>a+b,0); }

function pickRcePrices(json: any): number[] {
  // 1) direct arrays of numbers
  if (Array.isArray(json)) {
    const nums = json.map((x:any)=> Number(x)).filter(n=> Number.isFinite(n));
    if (nums.length >= 24) return nums.slice(0,24);
  }
  // 2) json.values: number[]
  if (Array.isArray(json?.values)) {
    const nums = json.values.map((x:any)=> Number(x)||0);
    if (nums.length >= 24) return nums.slice(0,24);
  }
  // 3) json.sample / json.data / json.rows: objects with rce_pln_mwh
  const candidates = [json?.sample, json?.data, json?.rows, json?.rce];
  for (const cand of candidates){
    if (Array.isArray(cand)) {
      const a = cand
        .map((x:any)=> Number(x?.rce_pln_mwh))
        .filter((n:number)=> Number.isFinite(n));
      if (a.length >= 24) return a.slice(0,24);
    }
  }
  // 4) deep search for arrays of objects containing rce_pln_mwh
  const found: number[] = [];
  const visit = (node:any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      const vals = node.map((x:any)=> Number(x?.rce_pln_mwh)).filter((n:number)=> Number.isFinite(n));
      if (vals.length) found.push(...vals);
      for (const el of node) visit(el);
    } else if (typeof node === "object") {
      for (const v of Object.values(node)) visit(v);
    }
  };
  visit(json);
  if (found.length >= 24) return found.slice(0,24);

  // fallback: 24 zeros
  return new Array(24).fill(0);
}

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });

    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const [y,m,d] = date.split("-").map(Number);

    // 1) GENERATION (kWh) — FoxESS report/day
    const series = await foxReportQueryDay({ sn, year:y, month:m, day:d, variables:["generation","feedin"] });
    const gen = series.find(s => String(s.variable||"").toLowerCase().includes("generation"));
    const genSeries: number[] = gen?.values || new Array(24).fill(0);
    const genUnit = gen?.unit || "kWh";

    // 2) RCE ceny [PLN/MWh] — używamy istniejącej trasy /api/rce
    const proto = (req.headers.get("x-forwarded-proto") || "https");
    const host = req.headers.get("host");
    const base = `${proto}://${host}`;
    const rceRes = await fetch(`${base}/api/rce?date=${date}`, { cache: "no-store" });
    const rceJson = await rceRes.json();
    const pricesMWh: number[] = pickRcePrices(rceJson);

    // 3) Revenue = generation_kWh * max(price,0)/1000  (liczymy wg GENERATION, nie export)
    const rows: Array<{ hour:number; kwh:number; price_pln_mwh:number; price_used_pln_mwh:number; revenue_pln:number; }> = [];
    for (let h=0; h<24; h++){
      const kwh = Number(genSeries[h] || 0);
      const price = Number(pricesMWh[h] || 0);
      const priceUsed = Math.max(price, 0);
      const revenue = kwh * (priceUsed/1000);
      rows.push({ hour:h, kwh:+kwh.toFixed(3), price_pln_mwh:+price.toFixed(2), price_used_pln_mwh:+priceUsed.toFixed(2), revenue_pln:+revenue.toFixed(2) });
    }
    const totalRevenue = +sum(rows.map(r=>r.revenue_pln)).toFixed(2);
    const totalKWh = +sum(genSeries).toFixed(3);

    return NextResponse.json({
      ok: true,
      date,
      unit: genUnit,
      rows,
      totals: { kwh: totalKWh, revenue_pln: totalRevenue },
      note: "Przychód liczony z GENERATION (kWh) * max(RCE,0)/1000. Ujemne ceny widoczne w price_pln_mwh, ale nie wliczane."
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
