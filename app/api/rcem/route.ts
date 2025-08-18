import { NextResponse } from "next/server";
import { getRCEmMap } from "@/lib/rcem";

export const revalidate = 3600;

export async function GET() {
  const map = getRCEmMap();
  const rows = Object.keys(map).sort().map(ym => ({ ym, value: map[ym] }));
  return NextResponse.json({ ok: true, rows });
}
