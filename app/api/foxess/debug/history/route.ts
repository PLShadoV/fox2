import { NextRequest, NextResponse } from "next/server";
import { foxHistoryDay } from "@/lib/foxess";

const EXPORT_VARS = ["feedin","feedIn","gridExportEnergy","gridExport","export","exportEnergy","gridOutEnergy","gridOut","sell","sellEnergy","toGrid","toGridEnergy","eOut"];
const GEN_VARS = ["generation","pvGeneration","production","yield","gen","eDay","dayEnergy"];

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const exp = await foxHistoryDay({ sn, date, variables: EXPORT_VARS });
    const gen = await foxHistoryDay({ sn, date, variables: GEN_VARS });
    const lower = (s:string)=> (s||'').toLowerCase();
    const pick = (arr:any[], names:string[]) => arr.find(v => names.map(lower).includes(lower(v.variable))) || null;
    return NextResponse.json({
      ok: true,
      date,
      export: { matched: pick(exp, EXPORT_VARS)?.variable || null, sample: (pick(exp, EXPORT_VARS)?.values || []).slice(0,6) },
      generation: { matched: pick(gen, GEN_VARS)?.variable || null, sample: (pick(gen, GEN_VARS)?.values || []).slice(0,6) },
      expVars: exp.map((x:any)=>x.variable),
      genVars: gen.map((x:any)=>x.variable)
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
