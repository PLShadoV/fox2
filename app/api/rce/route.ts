import { NextRequest, NextResponse } from "next/server";
import { fetchRCEForDate } from "@/lib/pse";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // YYYY-MM-DD
    if (!date) return NextResponse.json({ ok:false, error: "Missing ?date=YYYY-MM-DD" }, { status: 400 });
    const rows = await fetchRCEForDate(date);
    return NextResponse.json({ ok: true, rows });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 500 });
  }
}
