import { NextRequest, NextResponse } from "next/server";
import { foxReportQueryFlexible } from "@/lib/foxess-report-scan";

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const [y,m,d] = date.split("-").map(Number);
    const hits = await foxReportQueryFlexible({ sn, year:y, month:m, day:d });
    const best = hits.find(h=>h.ok) || null;
    return NextResponse.json({ ok:true, date, best, hits: hits.slice(0,10) });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
