import { NextRequest, NextResponse } from "next/server";
import { foxReportQueryDay } from "@/lib/foxess";

function sum(arr: number[]) { return arr.reduce((a,b)=>a+b,0); }

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
    if (!rceRes.ok) {
      const msg = await rceRes.text();
      return NextResponse.json({ ok:false, error:`Błąd RCE: ${rceRes.status} ${msg}` }, { status: 200 });
    }
    const rceJson = await rceRes.json();
    const prices: number[] = Array.isArray(rceJson?.data) ? rceJson.data.map((x:any)=> Number(x?.rce_pln_mwh)||0) :
                             Array.isArray(rceJson) ? rceJson.map((x:any)=> Number(x?.rce_pln_mwh)||0) :
                             Array.isArray(rceJson?.sample) ? rceJson.sample.map((x:any)=> Number(x?.rce_pln_mwh)||0) :
                             Array.isArray(rceJson?.values) ? rceJson.values.map((x:any)=> Number(x)||0) :
                             (Array.isArray(rceJson?.rce) ? rceJson.rce : new Array(24).fill(0));

    // 3) Revenue = generation_kWh * max(price,0)/1000  (liczymy wg GENERATION, nie export)
    const hours = Math.max(genSeries.length, prices.length, 24);
    const rows: Array<{ hour:number; kwh:number; price_pln_mwh:number; price_used_pln_mwh:number; revenue_pln:number; }> = [];
    for (let h=0; h<24; h++){
      const kwh = Number(genSeries[h] || 0);
      const price = Number(prices[h] || 0);
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
