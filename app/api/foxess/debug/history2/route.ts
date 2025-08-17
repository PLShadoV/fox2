import { NextRequest, NextResponse } from "next/server";
import { getDayExportAndGenerationKWh } from "@/lib/foxess-history-robust";

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const res = await getDayExportAndGenerationKWh(sn, date);
    return NextResponse.json({ ok:true, date, export: res.export, generation: res.generation });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
