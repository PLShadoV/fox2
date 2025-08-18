import { NextRequest, NextResponse } from 'next/server';
import rcem from '@/public/rcem.json';

function ymd(d: Date){ return d.toISOString().slice(0,10); }
function monthKey(dateStr: string){
  return dateStr.slice(0,7);
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const mode = (url.searchParams.get('mode')||'rcem').toLowerCase();
  if(!from || !to) return NextResponse.json({ ok:false, error:"Missing 'from' or 'to' param" }, { status: 400 });

  const base = url.origin;
  let d = new Date(from+"T00:00:00Z");
  const end = new Date(to+"T00:00:00Z");
  if(isNaN(d.getTime()) || isNaN(end.getTime())){
    return NextResponse.json({ ok:false, error:"Invalid 'from' or 'to' date" }, { status: 400 });
  }

  let sumKWh = 0;
  let revenue = 0;

  while(d <= end){
    const ds = ymd(d);
    const fox = await fetch(`${base}/api/foxess/day?date=${ds}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
    let kwhDay = 0;
    if(fox && fox.ok){
      // support multiple shapes
      const gen = fox.today?.generation || fox.generation || fox.today?.gen || null;
      if(gen){
        if(Array.isArray(gen.values)) kwhDay = (gen.values as number[]).reduce((a,v)=>a+(Number(v)||0),0);
        else if(Array.isArray(gen.series)) kwhDay = (gen.series as number[]).reduce((a,v)=>a+(Number(v)||0),0);
        else if(typeof gen.total === 'number') kwhDay = gen.total;
      }
    }
    sumKWh += kwhDay;

    if(mode === 'rcem'){
      const mk = monthKey(ds) as keyof typeof rcem;
      const price = (rcem as any)[mk] || 0; // PLN/MWh
      revenue += kwhDay * (price / 1000);
    } else {
      // RCE hourly (if your API exists)
      const rce = await fetch(`${base}/api/rce/day?date=${ds}`, { cache:'no-store' }).then(r=>r.json()).catch(()=>null);
      if(rce && rce.ok && Array.isArray(rce.rows)){
        // expect rows with hour, price_pln_mwh
        const rows = rce.rows;
        // need generation per hour too; if not supplied by rce endpoint, reuse foxess day hourly
        let series: number[] = [];
        const gen = fox?.today?.generation || fox?.generation;
        if(gen?.series) series = gen.series as number[];
        else if(gen?.values) series = gen.values as number[];
        for(let i=0;i<24;i++){
          const kwh = Number(series[i]||0);
          const price = Number(rows[i]?.rce_pln_mwh ?? rows[i]?.price_pln_mwh ?? 0);
          const used = Math.max(0, price);
          revenue += kwh * used / 1000;
        }
      }
    }

    d = new Date(d.getTime() + 86400*1000);
  }

  return NextResponse.json({ ok:true, kwh: Number(sumKWh.toFixed(3)), revenue_pln: Number(revenue.toFixed(2)), mode });
}