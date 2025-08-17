import { NextRequest, NextResponse } from "next/server";
import { fetchRCEv2 } from "@/lib/rce-v2";
import { safeDateOrToday } from "@/lib/date-utils";

export async function GET(req: NextRequest){
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const date = safeDateOrToday(dateParam);
    const data = await fetchRCEv2(date);
    return NextResponse.json(data);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
