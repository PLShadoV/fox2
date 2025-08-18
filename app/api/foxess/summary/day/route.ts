import { NextRequest, NextResponse } from "next/server";
import { foxReportQueryDay } from "@/lib/foxess";

function formatDateTZ(d: Date, tz: string){
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const y = parts.find(p=>p.type==='year')?.value || '0000';
  const m = parts.find(p=>p.type==='month')?.value || '01';
  const da = parts.find(p=>p.type==='day')?.value || '01';
  return `${y}-${m}-${da}`;
}
function hourInTZ(d: Date, tz:string){
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour:'2-digit', hour12:false }).formatToParts(d);
  return Number(parts.find(p=>p.type==='hour')?.value || '0');
}

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const [y,m,d] = date.split("-").map(Number);

    const series = await foxReportQueryDay({ sn, year:y, month:m, day:d, variables:["generation","feedin"] });
    const gen = series.find(s=> s.variable.toLowerCase().includes("generation"));
    const exp = series.find(s=> s.variable.toLowerCase().includes("feedin"));

    const sum = (a:number[]) => a.reduce((x,y)=> x+y, 0);
    const tz = "Europe/Warsaw";
    const todayTz = formatDateTZ(new Date(), tz);
    const isToday = date === todayTz;
    const h = isToday ? hourInTZ(new Date(), tz) : 24;

    const genSeries = gen?.values || new Array(24).fill(0);
    const expSeries = exp?.values || new Array(24).fill(0);

    const res = {
      ok: true,
      date,
      today: {
        date,
        generation: {
          unit: gen?.unit || "kWh",
          series: genSeries,
          total: +sum(genSeries).toFixed(3),
          toNow: +sum(genSeries.slice(0, h+1)).toFixed(3),
          variable: gen?.variable || "generation"
        },
        export: {
          unit: exp?.unit || "kWh",
          series: expSeries,
          total: +sum(expSeries).toFixed(3),
          toNow: +sum(expSeries.slice(0, h+1)).toFixed(3),
          variable: exp?.variable || "feedin"
        }
      }
    };
    return NextResponse.json(res);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
