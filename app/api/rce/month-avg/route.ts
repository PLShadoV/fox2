import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function daysInMonth(year:number, month:number){ // month: 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ ok:false, error:"date required" }, { status: 400 });

  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth()+1;
  const dim = daysInMonth(y,m);
  const origin = url.origin;

  const values:number[] = [];
  for (let day=1; day<=dim; day++){
    const ds = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    try{
      const r = await fetch(`${origin}/api/rce?date=${ds}`, { cache: "no-store" as any });
      if (!r.ok) continue;
      const j = await r.json();
      const rows = j?.rows || j?.data || j?.result || [];
      for (const row of rows){
        const v = Number(row.rce_pln_mwh ?? row.price ?? row.value ?? 0);
        if (Number.isFinite(v)) values.push(v);
      }
    }catch{}
  }
  const avg = values.length ? (values.reduce((a,b)=>a+b,0)/values.length) : 0;
  return NextResponse.json({ ok:true, rcem_pln_mwh: Number(avg.toFixed(2)), samples: values.length });
}
