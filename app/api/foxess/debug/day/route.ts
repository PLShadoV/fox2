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
    const sample = rep.slice(0, 3);

    // pick matches by non-zero sum
    const sum = (a:number[])=> a.reduce((x,y)=>x+y,0);
    const findFirst = (names:string[]) => {
      for (const n of names){
        const item = rep.find(r => r.variable.toLowerCase().includes(n.toLowerCase()));
        if (item && sum(item.values) > 0) return item.variable;
      }
      return null;
    };

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
