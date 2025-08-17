import { NextRequest, NextResponse } from "next/server";
import { foxHistoryDayNormalized } from "@/lib/foxess-history-robust";

const EXPORT_VARS = ["feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut","feedinPower"];
const GEN_VARS = ["generation","production","yield","eDay","dayEnergy","generationPower"];

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const res = await foxHistoryDayNormalized({ sn, date, exportVars: EXPORT_VARS, genVars: GEN_VARS });
    const findBest = (keys: string[]) => {
      const lower = (s:string)=> (s||'').toLowerCase();
      const kset = keys.map(lower);
      let best:any = null;
      for (const e of res) {
        const name = lower(e.variable || "");
        if (kset.includes(name)) { best = e; break; }
        if (!best && name.includes("feedin")) best = e;
      }
      return best;
    };
    const exportSeries = findBest(EXPORT_VARS);
    const genSeries = findBest(GEN_VARS);
    return NextResponse.json({
      ok: true,
      date,
      export: { variable: exportSeries?.variable || null, unit: exportSeries?.unit || null, values: exportSeries?.values || [] },
      generation: { variable: genSeries?.variable || null, unit: genSeries?.unit || null, values: genSeries?.values || [] },
      triedCount: res.length,
      triedVars: res.map(e=>e.variable)
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
