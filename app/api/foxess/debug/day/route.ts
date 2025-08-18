import { NextRequest, NextResponse } from "next/server";
import { foxReportQuery } from "@/lib/foxess";

const EXPORT_VARS = ["feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut"];
const GEN_VARS = ["generation","pvGeneration","production","yield","gen","eDay","dayEnergy"];

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const [y,m,d] = date.split("-").map(Number);

    const rep = await foxReportQuery({ sn, year: y, month: m, day: d, dimension: "day", variables: [...EXPORT_VARS, ...GEN_VARS] });
    const sample = Array.isArray(rep) ? (rep as any[]).slice(0, 3) : [];

    function findFirst(names:string[]){
      if (!Array.isArray(rep)) return null;
      const lc = names.map(s=>s.toLowerCase());
      for (const it of rep){
        const v = String((it as any).variable || (it as any).name || "").toLowerCase();
        if (lc.includes(v)) return it;
      }
      return null;
    }

    return NextResponse.json({
      ok:true,
      date,
      sample,
      matched:{
        export: findFirst(EXPORT_VARS),
        generation: findFirst(GEN_VARS)
      }
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
