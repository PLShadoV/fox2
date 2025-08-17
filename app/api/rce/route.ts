import { NextRequest, NextResponse } from "next/server";
import { getRCEForDate } from "@/lib/rce";

export async function GET(req: NextRequest){
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const rows = await getRCEForDate(date);
    return NextResponse.json({ ok:true, date, count: rows.length, rows });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
