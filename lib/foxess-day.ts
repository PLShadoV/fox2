import { NextRequest } from "next/server";

export function ymd(dateStr?: string) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return new Date().toISOString().slice(0,10);
}

export type DaySeries = { unit: "kWh"; series: number[]; total: number; variable: string };

async function callFoxessDay(req: NextRequest, date: string, variables: string[]) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host")!;
  const url   = `${proto}://${host}/api/foxess/debug/day-raw?date=${date}&vars=${variables.join(",")}`;
  const r = await fetch(url, { cache: "no-store" });
  return r.json();
}

function normalize24(vals: number[]): number[] {
  const out = new Array(24).fill(0);
  for (let i=0;i<Math.min(24, vals.length);i++) out[i] = Number(vals[i] || 0);
  return out;
}

export async function getDaySeriesKWh(req: NextRequest, date: string): Promise<DaySeries> {
  try {
    const j = await callFoxessDay(req, date, ["generation","eDay","dayEnergy","yield"]);
    const ok = j?.result?.[0]?.variable === "generation" && Array.isArray(j?.result?.[0]?.values);
    if (ok) {
      const arr = normalize24(j.result[0].values.map((x:number)=>+Number(x||0).toFixed(3)));
      const total = +arr.reduce((a,b)=>a+b,0).toFixed(3);
      return { unit: "kWh", series: arr, total, variable: "generation" };
    }
  } catch {}

  try {
    const j2 = await callFoxessDay(req, date, ["dayEnergy","eDay"]);
    const row = j2?.result?.find((r:any)=>Array.isArray(r?.values));
    if (row) {
      const arr = normalize24(row.values.map((x:number)=>+Number(x||0).toFixed(3)));
      const total = +arr.reduce((a,b)=>a+b,0).toFixed(3);
      return { unit: "kWh", series: arr, total, variable: row.variable || "dayEnergy" };
    }
  } catch {}

  return { unit: "kWh", series: new Array(24).fill(0), total: 0, variable: "generation" };
}
