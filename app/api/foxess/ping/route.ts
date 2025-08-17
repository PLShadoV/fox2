import { NextResponse } from "next/server";
import { foxPing } from "@/lib/foxess";

export async function GET() {
  try {
    const res = await foxPing();
    return NextResponse.json(res);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
