import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Helper to add days
function addDays(iso: string, by: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + by);
  return d.toISOString().slice(0,10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ ok: false, error: "Missing from/to" }, { status: 200 });
  }

  // Load RCEm table
  const file = path.join(process.cwd(), "public", "rcem.json");
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, number>;

  let d = from;
  let revenue_pln = 0;
  let generation_kwh = 0;

  // Iterate dates inclusive
  while (true) {
    const key = d.slice(0,7); // YYYY-MM
    const rcemMwh = data[key];
    const price = typeof rcemMwh === "number" ? rcemMwh : 0;

    // Get generation for that day
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/foxess/day?date=${d}`, { cache: "no-store" });
      const j = await r.json();
      const kwh = j?.today?.generation?.total ?? 0;
      generation_kwh += kwh;
      revenue_pln += (kwh * Math.max(0, price)) / 1000.0;
    } catch {}

    if (d === to) break;
    d = addDays(d, 1);
    // minimal pacing
    await new Promise(res => setTimeout(res, 150));
  }

  return NextResponse.json({ ok: true, generation_kwh, revenue_pln });
}