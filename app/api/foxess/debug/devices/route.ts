
import { NextResponse } from "next/server";
import { foxDevices } from "@/lib/foxess";

export async function GET(){
  try {
    const list = await foxDevices();
    return NextResponse.json({ ok: true, count: Array.isArray(list)? list.length : 0, sample: Array.isArray(list)? list.slice(0,3) : list });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
