import { NextRequest, NextResponse } from "next/server";
import { foxRealtimeQuery } from "@/lib/foxess";

export async function GET(){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const tried = ["pvPower","pv1Power","pv2Power","pvPowerW","generationPower","inverterPower","outputPower","ppv","ppvTotal","gridExportPower","feedinPower","acPower"];
    const out = await foxRealtimeQuery({ sn, variables: tried });
    return NextResponse.json(out);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
