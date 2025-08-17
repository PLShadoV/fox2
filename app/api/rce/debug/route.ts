
import { NextRequest, NextResponse } from "next/server";
import { fetchRCEForDate } from "@/lib/pse";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const rows = await fetchRCEForDate(date);
    const keys = rows.length ? Object.keys(rows[0]) : [];
    return NextResponse.json({ ok:true, date, count: rows.length, keys, sample: rows.slice(0,4) });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
