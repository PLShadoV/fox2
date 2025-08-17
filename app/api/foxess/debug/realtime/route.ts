import { NextResponse } from "next/server";
import { foxRealtimeRaw } from "@/lib/foxess";

const RT_VARS = ["pvPower","pv1Power","pv2Power","pvPowerW","generationPower","inverterPower","outputPower","ppv","ppvTotal","gridExportPower","feedinPower","acPower"];

export async function GET() {
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const r = await foxRealtimeRaw(sn, RT_VARS);
    return NextResponse.json({ ok:true, tried: RT_VARS, matched: r.matchedVar, pvNowW: r.pvNowW, raw: r.raw });
  } catch (e:any) { return NextResponse.json({ ok:false, error: e.message }); }
}
