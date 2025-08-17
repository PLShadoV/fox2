import { NextRequest, NextResponse } from "next/server";
import { getDayTotals, isValidDateStr, todayStrInWarsaw } from "@/lib/foxess-history-robust";

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const q = url.searchParams.get("date");
    const date = isValidDateStr(q) ? String(q) : todayStrInWarsaw();

    const out = await getDayTotals(sn, date);

    // previous day quick helper
    const dt = new Date(date + "T00:00:00");
    dt.setDate(dt.getDate() - 1);
    const y = dt.toISOString().slice(0,10);
    const prev = await getDayTotals(sn, y);

    return NextResponse.json({ ok:true, date, today: out, previous: { date: y, generationKWh: prev.generation.total, exportKWh: prev.export.total } });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
