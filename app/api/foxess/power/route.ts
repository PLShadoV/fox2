import { NextRequest, NextResponse } from "next/server";
import { foxPowerDay } from "@/lib/foxess-power";
import { getCached } from "@/lib/cache";
import { rateLimit } from "@/lib/rate";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    // rate limit (60s per unique day to protect quota)
    await rateLimit("foxess:power:" + date, 60000);
    const res = await getCached("foxess:power:" + date, 600, async () => {
      return foxPowerDay(date);
    });
    return NextResponse.json({ ok: true, date, ...res });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 200 });
  }
}
