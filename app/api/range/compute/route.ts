import { NextRequest, NextResponse } from "next/server";
import { pLimit } from "@/lib/plimit";
import { getCached } from "@/lib/cache";

const FOX_DAY_TTL = 6 * 3600;
const RCE_DAY_TTL = 24 * 3600;
const RCEM_TTL = 24 * 3600;

function toLocalISODate(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0,10);
}

function listDays(from: string, to: string) {
  const res: string[] = [];
  let d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end) {
    res.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return res;
}

// Replace URLs below with your existing endpoints if needed.
async function dayGeneration(date: string): Promise<{ series: number[], total: number }> {
  const j = await getCached("gen:"+date, FOX_DAY_TTL, async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/foxess/history2?date=${date}`, { cache: "no-store" });
    const j = await r.json();
    // Expected shape (adapt to yours): { generation:{ unit:"kWh", values:number[24] } }
    const arr: number[] = j?.generation?.values || j?.generationKWh || j?.values || Array(24).fill(0);
    return { series: arr, total: arr.reduce((a:number,b:number)=>a+b,0) };
  });
  return j;
}

async function dayRCE(date: string): Promise<number[]> {
  const j = await getCached("rce:"+date, RCE_DAY_TTL, async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/rce?date=${date}`, { next: { revalidate: 3600 } });
    const j = await r.json();
    // Expected j.rows[i].price_pln_mwh
    const rows = j?.rows || [];
    const vals = rows.map((x:any)=> Number(x.rce_pln_mwh ?? x.price_pln_mwh ?? 0));
    if (vals.length === 96) {
      // 96x 15min -> 24x 1h (avg)
      const hour = [];
      for (let h=0; h<24; h++) {
        const start = h*4;
        const slice = vals.slice(start, start+4);
        hour.push(slice.reduce((a,b)=>a+b,0)/slice.length);
      }
      return hour;
    }
    return vals.length === 24 ? vals : Array(24).fill(0);
  });
  return j;
}

async function monthRCEm(year:number, month:number): Promise<number> {
  const j = await getCached(`rcem:${year}-${month}`, RCEM_TTL, async () => {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/rcem`, { next: { revalidate: 3600 } });
    const j = await r.json();
    const row = (j?.rows || []).find((x:any)=> (x.year===year) && (x.monthIndex===month-1));
    return row ? Number(row.rcem_pln_mwh) : 0;
  });
  return j;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || toLocalISODate(new Date());
    const to = url.searchParams.get("to") || from;
    const mode = (url.searchParams.get("mode") || "rce") as "rce"|"rcem";

    const days = listDays(from, to);
    const limit = pLimit(3);

    // 1) FOX gen for all days (concurrency limited)
    const genAll = await Promise.all(
      days.map(d => limit(() => dayGeneration(d).catch(()=>({ series:Array(24).fill(0), total:0 })))));

    if (mode === "rcem") {
      let totalKWh = 0, totalPLN = 0;
      for (let i=0;i<days.length;i++) {
        const d = new Date(days[i]+"T00:00:00");
        const m = d.getMonth()+1, y = d.getFullYear();
        const gen = genAll[i].total;
        if (!gen) continue;
        const price = await monthRCEm(y,m);
        totalKWh += gen;
        totalPLN += gen * Math.max(0, price)/1000;
      }
      return NextResponse.json({ ok:true, mode, from, to, totals:{ kwh: +totalKWh.toFixed(3), revenue_pln: +totalPLN.toFixed(2) } });
    }

    // 2) RCE: fetch only for days with production
    const idx = genAll.map((g,i)=> g.total>0 ? i : -1).filter(i=>i>=0);
    const rceAll = await Promise.all(idx.map(i => limit(()=> dayRCE(days[i]).catch(()=>Array(24).fill(0)))));

    // 3) sum
    let totalKWh = 0, totalPLN = 0, k=0;
    for (let i=0;i<days.length;i++) {
      const gen = genAll[i];
      totalKWh += gen.total;
      if (gen.total>0) {
        const prices = rceAll[k++];
        for (let h=0; h<24; h++) {
          const p = Math.max(0, prices[h] || 0);
          totalPLN += gen.series[h] * p / 1000;
        }
      }
    }
    return NextResponse.json({ ok:true, mode, from, to, totals:{ kwh:+totalKWh.toFixed(3), revenue_pln:+totalPLN.toFixed(2) } });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 200 });
  }
}
