import { NextRequest, NextResponse } from "next/server";
import { foxReportQuery } from "@/lib/foxess";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    const token = process.env.FOXESS_API_KEY || process.env.FOXESS_OAUTH_BEARER || "";
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // YYYY-MM-DD

    if (!date) return NextResponse.json({ ok: false, error: "Missing ?date=YYYY-MM-DD" }, { status: 200 });
    if (!sn || !token) {
      return NextResponse.json({ ok: false, error: "Brak konfiguracji FOXESS (FOXESS_INVERTER_SN lub token)." }, { status: 200 });
    }
    const [y,m,d] = date.split("-").map(Number);

    const result = await foxReportQuery({
      sn,
      year: y, month: m, day: d,
      dimension: "day",
      variables: ["feedin", "generation"],
    });

    return NextResponse.json({ ok: true, result, tz: process.env.TZ || "Europe/Warsaw" });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
