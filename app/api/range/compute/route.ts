import { NextRequest, NextResponse } from "next/server";

type Mode = "rce" | "rcem";

function isIsoDate(s?: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDays(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Build absolute base URL for server-to-server fetches
function baseUrl(req: NextRequest) {
  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const host  = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ   = url.searchParams.get("to");
  const modeQ = (url.searchParams.get("mode") || "rce").toLowerCase() as Mode;

  if (!isIsoDate(fromQ) || !isIsoDate(toQ)) {
    return NextResponse.json({ ok: false, error: "Invalid 'from' or 'to' date" }, { status: 200 });
  }
  if (modeQ !== "rce" && modeQ !== "rcem") {
    return NextResponse.json({ ok: false, error: "Invalid 'mode' (use rce or rcem)" }, { status: 200 });
  }

  const from = new Date(fromQ + "T00:00:00Z");
  const to   = new Date(toQ   + "T00:00:00Z");
  if (!(from.getTime() <= to.getTime())) {
    return NextResponse.json({ ok: false, error: "'from' must be <= 'to'" }, { status: 200 });
  }

  const base = baseUrl(req);

  // Preload RCEm (monthly) once if needed
  let rcemByMonth: Record<string, number> | null = null;
  if (modeQ === "rcem") {
    const r = await fetch(`${base}/api/rcem`, { next: { revalidate: 60 * 60 } });
    const j = await r.json();
    if (!j || !j.ok || !Array.isArray(j.rows)) {
      return NextResponse.json({ ok: false, error: "RCEm endpoint returned no data" }, { status: 200 });
    }
    rcemByMonth = {};
    for (const row of j.rows) {
      // Expect { year, month, value } or { ym: '2025-07', value }
      const ym = row.ym || `${row.year}-${String(row.month).padStart(2,"0")}`;
      const val = Number(row.value);
      if (!Number.isNaN(val)) rcemByMonth[ym] = val;
    }
  }

  type DayRow = { date: string, kwh: number, revenue_pln: number };

  const rows: DayRow[] = [];
  let sumKWh = 0;
  let sumPLN = 0;

  // Iterate days inclusive
  for (let d = new Date(from); d.getTime() <= to.getTime(); d = addDays(d, 1)) {
    const date = toISO(d);

    // Use cached day summary to stay under FoxESS rate limits.
    // This route aggregates GENERATION per hour for the given date.
    const fox = await fetch(`${base}/api/foxess/summary/day-cached?date=${date}`, { cache: "no-store" });
    if (!fox.ok) {
      return NextResponse.json({ ok: false, error: `FoxESS day failed for ${date} (HTTP ${fox.status})` }, { status: 200 });
    }
    const jFox = await fox.json();
    if (!jFox?.ok || !jFox?.today?.generation) {
      return NextResponse.json({ ok: false, error: `FoxESS day invalid payload for ${date}` }, { status: 200 });
    }
    const series: number[] = Array.isArray(jFox.today.generation.series) ? jFox.today.generation.series : new Array(24).fill(0);
    const totalKWh: number = Number(jFox.today.generation.total ?? series.reduce((a: number, b: number) => a + Number(b || 0), 0)) || 0;

    let revenue = 0;

    if (modeQ === "rce") {
      // Hourly price
      const rce = await fetch(`${base}/api/rce?date=${date}`, { next: { revalidate: 60 * 60 } });
      const jR = await rce.json();
      if (!jR?.ok || !Array.isArray(jR.rows)) {
        return NextResponse.json({ ok: false, error: `RCE missing for ${date}` }, { status: 200 });
      }
      // jR.rows: [{ hour, rce_pln_mwh }, ...] length 24
      for (let h = 0; h < 24; h++) {
        const gen = Number(series[h] || 0);
        const price = Number((jR.rows[h]?.rce_pln_mwh) ?? 0);
        const used = Math.max(0, price); // ignore negatives
        revenue += gen * used / 1000;
      }
    } else {
      // Monthly RCEm
      const ym = `${date.slice(0,4)}-${date.slice(5,7)}`;
      const val = (rcemByMonth && rcemByMonth[ym]) || 0;
      const used = Math.max(0, Number(val) || 0);
      revenue = totalKWh * used / 1000;
    }

    rows.push({ date, kwh: Number(totalKWh.toFixed(2)), revenue_pln: Number(revenue.toFixed(2)) });
    sumKWh += totalKWh;
    sumPLN += revenue;
  }

  return NextResponse.json({
    ok: true,
    mode: modeQ,
    from: fromQ,
    to: toQ,
    sum: { kwh: Number(sumKWh.toFixed(2)), revenue_pln: Number(sumPLN.toFixed(2)) },
    rows
  }, { status: 200 });
}