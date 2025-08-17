import { NextRequest, NextResponse } from "next/server";
import { foxHistoryFetchVar } from "@/lib/foxess-history-robust";

const EXPORT_VARS = ["feedinPower","feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut"];
const GEN_VARS = ["generationPower","generation","production","yield","eDay","dayEnergy"];

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);

    const pick = async (vars: string[]) => {
      for (const v of vars) {
        const s = await foxHistoryFetchVar(sn, date, v);
        if (s.values.some(x=>x>0)) return s;
      }
      return await foxHistoryFetchVar(sn, date, vars[0]);
    };

    const exportSeries = await pick(EXPORT_VARS);
    const generationSeries = await pick(GEN_VARS);

    return NextResponse.json({
      ok:true, date,
      export: { variable: exportSeries.variable, sample: exportSeries.values.slice(0,6) },
      generation: { variable: generationSeries.variable, sample: generationSeries.values.slice(0,6) }
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
