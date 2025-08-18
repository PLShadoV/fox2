import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cache = { ts: number; value: any };
const ONE_HOUR = 60 * 60 * 1000;
const mem: Record<string, Cache> = {};

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

function monthDays(year:number, month:number){
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-12
  const out: string[] = [];
  for (let d=1; d<=last; d++){
    const dd = String(d).padStart(2,"0");
    out.push(`${year}-${String(month).padStart(2,"0")}-${dd}`);
  }
  return out;
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if(!date) return NextResponse.json({ error: "date required" }, { status: 400 });
  const origin = url.origin;

  const [Y, M] = date.split("-").map(x=> parseInt(x,10));
  if (!Y || !M) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  const key = `${Y}-${String(M).padStart(2,"0")}`;

  const now = Date.now();
  const cached = mem[key];
  if (cached && now - cached.ts < ONE_HOUR) return NextResponse.json(cached.value);

  // Collect hourly RCE for every day of the month, clamp negatives to 0, compute mean of all hours
  const days = monthDays(Y, M);
  let sum = 0;
  let n = 0;
  for (const d of days){
    try{
      const r = await j(`${origin}/api/rce?date=${d}`);
      const rows: Array<{ rce_pln_mwh: number }> = r?.rows || [];
      for (const row of rows){
        const v = Math.max(Number(row.rce_pln_mwh ?? 0), 0);
        sum += v; n += 1;
      }
    } catch { /* ignore missing days */ }
  }
  const avg = n > 0 ? Number((sum / n).toFixed(2)) : 0;
  const payload = { ok: true, month: key, rcem_pln_mwh: avg, hours_counted: n };

  mem[key] = { ts: now, value: payload };
  return NextResponse.json(payload);
}
