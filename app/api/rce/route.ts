import { NextRequest, NextResponse } from "next/server";
import { getRCEForDate } from "@/lib/rce";
import { safeDateOrToday } from "@/lib/date-utils";

export async function GET(req: NextRequest){
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const date = safeDateOrToday(dateParam);
    const rows = await getRCEForDate(date);
    return NextResponse.json({ ok:true, date, rows });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
