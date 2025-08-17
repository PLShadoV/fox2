import { NextRequest, NextResponse } from "next/server";
import { foxDevices } from "@/lib/foxess";

export async function GET(){
  try {
    const out = await foxDevices();
    return NextResponse.json(out);
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
