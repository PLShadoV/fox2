import { NextRequest, NextResponse } from "next/server";
import { getRCEForDate } from "@/lib/rce";
import { safeDateOrToday } from "@/lib/date-utils";
import fs from "fs";
import path from "path";

function toISO(d: Date){ return d.toISOString().slice(0,10); }

function getRCEmPricePLNperMWh(date: string): number | null {
  try{
    const fp = path.join(process.cwd(), "data", "rcem.json");
    const raw = fs.readFileSync(fp, "utf8");
    const map = JSON.parse(raw) as Record<string, number>;
    const ym = date.slice(0,7);
    if (map[ym] != null) return Number(map[ym]);
  }catch{/* no local file */}
  return null;
}

export async function GET(req: NextRequest){
  try{
    const url = new URL(req.url);
    const date = safeDateOrToday(url.searchParams.get("date"));
    const mode = (url.searchParams.get("mode") || "rce").toLowerCase(); // "rce" | "rcem"

    // 1) Hourly kWh from FoxESS (exportKWh preferred for revenue)
    const fox = await fetch(`${url.origin}/api/foxess?date=${date}`, { cache: "no-store" as any });
    if (!fox.ok) throw new Error("FoxESS day failed: " + fox.status);
    const foxJson = await fox.json();
    const kwh24: number[] = (foxJson?.exportKWh || []) as number[];

    // Ensure length 24
    const arr = new Array(24).fill(0).map((_,i)=> Number(kwh24?.[i] ?? 0));

    // 2) Prices
    const rceRows = await getRCEForDate(date); // [{ timeISO, rce_pln_mwh }]
    const hourlyRCE = rceRows.map(r => Number(r.rce_pln_mwh || 0));

    let usedPriceMWh: number[];
    if (mode === "rcem"){
      const mPrice = getRCEmPricePLNperMWh(date);
      if (mPrice == null) {
        // fallback: simple average of hourly RCE for that day
        const sum = hourlyRCE.reduce((a,b)=>a+(Number.isFinite(b)?b:0),0);
        const count = hourlyRCE.filter(x=>Number.isFinite(x)).length || 24;
        const avg = sum / count;
        usedPriceMWh = new Array(24).fill(avg);
      }else{
        usedPriceMWh = new Array(24).fill(mPrice);
      }
    } else {
      usedPriceMWh = hourlyRCE;
    }

    // 3) Compose rows & totals
    const rows = [];
    let total = 0;
    for (let h=0; h<24; h++){
      const kwh = Number(arr[h] || 0);
      const priceMWh = Number(hourlyRCE[h] || 0);
      const priceUsed = Number(usedPriceMWh[h] || 0);
      const revenue = kwh * (priceUsed / 1000); // PLN
      total += revenue;
      rows.push({
        hour: h,
        kwh: +kwh.toFixed(3),
        price_pln_mwh: +priceMWh.toFixed(2),
        price_used_pln_mwh: +priceUsed.toFixed(2),
        revenue_pln: +revenue.toFixed(2),
      });
    }

    const payload = {
      ok: true,
      date,
      mode,
      rows,
      totals: { kwh: Number(arr.reduce((a,b)=>a+b,0).toFixed(1)), revenue_pln: Number(total.toFixed(2)) }
    };
    return NextResponse.json(payload);
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 200 });
  }
}
