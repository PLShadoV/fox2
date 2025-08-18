import { NextRequest, NextResponse } from "next/server";
import { getDayTotals } from "@/lib/foxess-history-robust";
import { safeDateOrToday } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest){
  try {
    const url = new URL(req.url);
    const date = safeDateOrToday(url.searchParams.get("date"));
    const sn = process.env.FOXESS_INVERTER_SN || process.env.FOXESS_SN || "";
    if (!sn) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN" }, { status: 200 });

    const totals = await getDayTotals(sn, date);
    // Normalize shape for frontend
    const res = {
      ok: true,
      date,
      today: {
        generation: {
          unit: totals.generation.unit,
          series: totals.generation.series,
          total: totals.generation.total,
          toNow: totals.generation.toNow,
          variable: totals.generation.variable
        },
        export: {
          unit: totals.export.unit,
          series: totals.export.series,
          total: totals.export.total,
          toNow: totals.export.toNow,
          variable: totals.export.variable
        }
      }
    };
    return NextResponse.json(res);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
