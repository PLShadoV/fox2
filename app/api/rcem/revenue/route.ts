import { NextResponse } from "next/server";
import rcemMap from "@/public/rcem.json";

function fmt(d:Date){ return d.toISOString().slice(0,10); }
function monthKey(d:Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

export async function GET(req: Request){
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if(!from || !to) return NextResponse.json({ok:false, error:"Missing from/to"}, {status:400});
  const dFrom = new Date(from+"T00:00:00");
  const dTo = new Date(to+"T00:00:00");
  if(isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) return NextResponse.json({ok:false, error:"Invalid dates"}, {status:400});
  if(dTo < dFrom) return NextResponse.json({ok:false, error:"to < from"}, {status:400});

  // iterate by day, fetch generation total from your own foxess/day endpoint,
  // multiply by monthly RCEm from static file (PLN/MWh) -> PLN
  let revenue_pln = 0;
  let generation_kwh = 0;

  const dayMs = 24*60*60*1000;
  for(let t=dFrom.getTime(); t<=dTo.getTime(); t+=dayMs){
    const d = new Date(t);
    const key = monthKey(d) as keyof typeof rcemMap;
    const price = (rcemMap as any)[key]; // PLN/MWh
    if(typeof price !== "number") continue; // no price for that month -> skip

    const dateStr = fmt(d);
    try{
      const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/foxess/day?date=${dateStr}`, { cache: "no-store" });
      const j = await r.json();
      const kwh = j?.today?.generation?.total ?? 0;
      generation_kwh += (kwh || 0);
      revenue_pln += (kwh || 0) * (price/1000); // PLN/MWh -> PLN/kWh
      // tiny pause to be gentle (and to help with FoxESS rate limits when proxying)
      await new Promise(res=>setTimeout(res, 150));
    }catch(_e){
      // ignore this day
    }
  }

  return NextResponse.json({ ok:true, revenue_pln: Number(revenue_pln.toFixed(2)), generation_kwh: Number(generation_kwh.toFixed(2)) });
}
