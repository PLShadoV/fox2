import { NextResponse } from "next/server";

function labelPl(m:number){
  const names = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
  return names[m];
}

export async function GET(){
  try{
    const today = new Date();
    today.setDate(1);
    const out:any[] = [];

    for (let i=0;i<12;i++){
      const d = new Date(today);
      d.setMonth(d.getMonth()-i);
      const y = d.getFullYear();
      const m = d.getMonth();

      const first = new Date(y, m, 1);
      const next  = new Date(y, m+1, 1);

      let sum = 0, n = 0;
      for (let day = new Date(first); day < next; day.setDate(day.getDate()+1)){
        const dateStr = day.toISOString().slice(0,10);
        try{
          const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/rce?date=${dateStr}`, { cache: "no-store" });
          if (!r.ok) continue;
          const j = await r.json();
          const rows = (j?.rows || j) as any[];
          for (const row of rows){
            const v = Number(row?.rce_pln_mwh ?? row?.price_pln_mwh ?? 0);
            if (!Number.isNaN(v)){ sum += v; n++; }
          }
        }catch{}
      }
      const value = n ? (sum/n) : null;
      out.push({ year:y, monthIndex:m, monthLabel: labelPl(m), value, ym: `${y}-${String(m+1).padStart(2,"0")}` });
    }
    return NextResponse.json({ ok:true, items: out });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:200 });
  }
}
