import map from '@/public/rcem.json';
import { NextRequest } from 'next/server';

type RCEmMap = Record<string, number>;

function parseDate(s: string): Date | null {
  if (!/\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s+'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function* eachDate(from: Date, to: Date) {
  const cur = new Date(from); 
  while (cur <= to) {
    yield cur.toISOString().slice(0,10);
    cur.setDate(cur.getDate() + 1);
  }
}

function rcemFor(date: string): number | null {
  const key = date.slice(0,7);
  const m = (map as RCEmMap)[key];
  return typeof m === 'number' ? m : null;
}

function normalizeHourly(gen: any): number[] {
  const arr = gen?.series || gen?.values || gen || [];
  if (!Array.isArray(arr)) return new Array(24).fill(0);
  const nums = arr.map((x:any)=> Number(x) || 0);
  // diff if looks cumulative
  const diffs:number[] = []; let prev=0;
  for(let i=0;i<nums.length;i++){ diffs.push(Math.max(0, +(nums[i]-prev).toFixed(3))); prev = nums[i]; }
  const sumNums = nums.reduce((a,b)=>a+b,0);
  const sumDiffs = diffs.reduce((a,b)=>a+b,0);
  return (sumNums>sumDiffs*1.8) ? diffs.slice(0,24) : nums.slice(0,24);
}

export async function GET(req: NextRequest) {
  try{
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const mode = (url.searchParams.get('mode') || 'rce').toLowerCase();

    const d1 = parseDate(from); const d2 = parseDate(to);
    if(!d1 || !d2) return Response.json({ ok:false, error: "Invalid 'from' or 'to' date" }, { status: 200 });

    const origin = url.origin;
    let sumKWh = 0;
    let sumRevenue = 0;

    for (const day of eachDate(d1, d2)) {
      // Fetch FoxESS day from your existing endpoint
      const fr = await fetch(`${origin}/api/foxess/day?date=${day}`, { cache: 'no-store' });
      if (!fr.ok) throw new Error(`FoxESS day failed for ${day}`);
      const fj = await fr.json();
      if (fj.ok===false) throw new Error(`FoxESS day invalid payload for ${day}`);

      const hourly = normalizeHourly(fj?.today?.generation || fj?.generation || fj?.result?.[0]);
      const kwh = hourly.reduce((a:number,b:number)=>a+b,0);
      sumKWh += kwh;

      if (mode === 'rcem') {
        const price = rcemFor(day) || 0;
        sumRevenue += kwh * (price/1000);
      } else { // rce hourly; if unavailable, fall back to rcem for that day
        const rr = await fetch(`${origin}/api/rce/day?date=${day}`, { cache: 'no-store' });
        if (rr.ok) {
          const rj = await rr.json();
          const rows = rj?.rows || rj?.data || rj;
          const prices:number[] = Array.isArray(rows) ? rows.map((x:any)=> Number(x.rce_pln_mwh ?? x.price_pln_mwh ?? 0)) : [];
          for (let i=0;i<24;i++) {
            const p = Math.max(0, prices[i]||0);
            sumRevenue += (hourly[i]||0) * (p/1000);
          }
        } else {
          const price = rcemFor(day) || 0;
          sumRevenue += kwh * (price/1000);
        }
      }
    }

    return Response.json({ ok:true, sumKWh:+sumKWh.toFixed(2), sumRevenue:+sumRevenue.toFixed(2) }, { status: 200 });
  } catch(e:any) {
    return Response.json({ ok:false, error: e.message }, { status: 200 });
  }
}
