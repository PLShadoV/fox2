import { NextRequest, NextResponse } from "next/server";
import { ymd, getDaySeriesKWh } from "@/lib/foxess-day";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = ymd(url.searchParams.get("date") || undefined);

  try {
    const gen = await getDaySeriesKWh(req, date);
    const today = {
      date,
      generation: gen,
      export: { unit: "kWh", series: new Array(24).fill(0), total: 0, variable: "feedin" }
    };
    return NextResponse.json({ ok: true, date, today });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || "day-failed", date }, { status: 200 });
  }
}
