import { NextRequest, NextResponse } from "next/server";
import { foxReportQuerySplit, foxHistoryDay } from "@/lib/foxess";

const EXPORT_VARS = ["feedin","feedIn","gridExportEnergy","gridExport","export","exportEnergy","gridOutEnergy","gridOut","sell","sellEnergy","toGrid","toGridEnergy","eOut"];
const GEN_VARS = ["generation","pvGeneration","production","yield","gen","eDay","dayEnergy"];

export async function GET(req: NextRequest) {
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);

    let result:any[] = [];
    try {
      result = await foxReportQuerySplit({ sn, date, exportVars: EXPORT_VARS, genVars: GEN_VARS, lang: process.env.FOXESS_API_LANG || "pl" });
    } catch {}

    // Fallback do history/query jeśli pusto
    if (!result.length) {
      const exp = await foxHistoryDay({ sn, date, variables: EXPORT_VARS });
      const gen = await foxHistoryDay({ sn, date, variables: GEN_VARS });
      result = [...(exp||[]), ...(gen||[])];
    }

    const lower = (s:string)=> (s||'').toLowerCase();
    const findVar = (names:string[]) => result.find((v:any) => names.map(lower).includes(lower(v.variable)));
    const exportVar = findVar(EXPORT_VARS) || null;
    const genVar = findVar(GEN_VARS) || null;
    const sample = (v?: number[]) => (v||[]).slice(0,6);

    return NextResponse.json({
      ok:true,
      date,
      matched: {
        export: exportVar?.variable || null,
        generation: genVar?.variable || null
      },
      values: {
        exportSample: sample(exportVar?.values),
        generationSample: sample(genVar?.values)
      },
      rawCount: result.length,
      rawVars: result.map((r:any) => r.variable)
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
