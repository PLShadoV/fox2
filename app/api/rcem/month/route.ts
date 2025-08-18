import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const file = path.join(process.cwd(), "public", "rcem.json");
    const raw = fs.readFileSync(file, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ ok: true, data });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}