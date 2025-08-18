// app/api/range/compute/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------- utils -------------------- */
const zpad = (n: number) => (n < 10 ? `0${n}` : String(n));
const ymdUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${zpad(d.getUTCMonth() + 1)}-${zpad(d.getUTCDate())}`;

function parseDateLoose(v: string | null): Date | null {
  if (!v) return null;
  const s = v.trim();

  // 2025-08-17
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  // 17.08.2025
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [dd, mm, yy] = s.split(".");
    const d = new Date(`${yy}-${mm}-${dd}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const arr24 = (src?: any[]) =>
  Array.from({ length: 24 }, (_, i) => Number(src?.[i] ?? 0) || 0);

const clampPos = (n: number) => (isFinite(n) && n > 0 ? n : 0);

async function getJSON<T = any>(
  req: NextRequest,
  path: string,
  timeoutMs = 8000
): Promise<T | null> {
  try {
    const url = new URL(path, req.url);
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { cache: "no-store", signal: ctl.signal });
    clearTimeout(id);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* -------------------- lightweight caches -------------------- */
const genCache = new Map<string, number[]>();     // YYYY-MM-DD -> [kWh x24]
const rceCache = new Map<string, number[]>();     // YYYY-MM-DD -> [PLN/MWh x24]
const rcemCache = new Map<string, number>();      // YYYY-MM -> PLN/MWh

async function getDayGeneration(req: NextRequest, day: string) {
  if (genCache.has(day)) return genCache.get(day)!;

  // próbujemy kilka wewnętrznych endpointów (które już masz w projekcie)
  const tries = [
    `/api/foxess/day?date=${day}`,
    `/api/foxess?date=${day}`,
    `/api/foxess/debug/history2?date=${day}`,
    `/api/foxess/debug/history?date=${day}`,
  ];
  for (const p of tries) {
    const j: any = await getJSON(req, p);
    if (!j) continue;

    // formaty spotkane w logach
    const s1 = j?.today?.generation?.series;
    if (Array.isArray(s1)) {
      const v = arr24(s1);
      genCache.set(day, v);
      return v;
    }
    const s2 = j?.generation?.values;
    if (Array.isArray(s2)) {
      const v = arr24(s2);
      genCache.set(day, v);
      return v;
    }
    const s3 = j?.values?.generationKWh;
    if (Array.isArray(s3)) {
      const v = arr24(s3);
      genCache.set(day, v);
      return v;
    }
    const resArr = j?.result;
    if (Array.isArray(resArr)) {
      const hit =
        resArr.find((x: any) =>
          String(x?.variable).toLowerCase().includes("generation")
        ) ||
        resArr.find((x: any) =>
          String(x?.variable).toLowerCase().includes("eday")
        );
      if (hit?.values && Array.isArray(hit.values)) {
        const v = arr24(hit.values);
        genCache.set(day, v);
        return v;
      }
    }
  }
  const zero = new Array(24).fill(0);
  genCache.set(day, zero);
  return zero;
}

async function getDayRCE(req: NextRequest, day: string) {
  if (rceCache.has(day)) return rceCache.get(day)!;
  const j: any =
    (await getJSON(req, `/api/rce?date=${day}`)) ??
    (await getJSON(req, `/api/rce-pln?date=${day}`));

  let vals: number[] | null = null;
  if (Array.isArray(j?.rows))
    vals = arr24(j.rows.map((x: any) => Number(x?.rce_pln_mwh ?? 0)));
  else if (Array.isArray(j?.sample))
    vals = arr24(j.sample.map((x: any) => Number(x?.rce_pln_mwh ?? 0)));
  else if (Array.isArray(j?.values))
    vals = arr24(j.values);
  else if (Array.isArray(j?.hours))
    vals = arr24(j.hours);

  vals ||= new Array(24).fill(0);
  rceCache.set(day, vals);
  return vals;
}

async function getRCEm(req: NextRequest, y: number, m1: number) {
  const ym = `${y}-${zpad(m1)}`;
  if (rcemCache.has(ym)) return rcemCache.get(ym)!;

  // endpoint miesięczny (jeśli istnieje)
  const j: any = await getJSON(req, `/api/rcem?month=${ym}`);
  const direct =
    Number(j?.value_pln_mwh) ||
    Number(j?.rcem_pln_mwh) ||
    Number(j?.value);
  if (isFinite(direct) && direct > 0) {
    rcemCache.set(ym, Number(direct));
    return Number(direct);
  }

  // fallback: średnia z godzinowych RCE
  const first = new Date(Date.UTC(y, m1 - 1, 1));
  const next = new Date(Date.UTC(y, m1, 1));
  let sum = 0, cnt = 0;
  for (let d = new Date(first); d < next; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = ymdUTC(d);
    const arr = await getDayRCE(req, day);
    for (const v of arr) {
      if (isFinite(v)) { sum += v; cnt++; }
    }
  }
  const avg = cnt ? sum / cnt : 0;
  rcemCache.set(ym, avg);
  return avg;
}

/* -------------------- main handler -------------------- */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const mode = (url.searchParams.get("mode") || "rce").toLowerCase(); // rce | rcem

    const from = parseDateLoose(fromRaw);
    const to = parseDateLoose(toRaw);
    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: "Invalid 'from' or 'to' date" },
        { status: 200 }
      );
    }

    let a = from.getTime();
    let b = to.getTime();
    if (a > b) [a, b] = [b, a];

    const MAX_DAYS = 92; // miękki limit bezpieczeństwa
    const days: string[] = [];
    for (let d = new Date(a); d.getTime() <= b; d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(ymdUTC(d));
      if (days.length > MAX_DAYS) break;
    }

    let sumKWh = 0;
    let sumPLN = 0;

    for (const day of days) {
      const gen = await getDayGeneration(req, day); // [kWh x24]
      const dayKWh = gen.reduce((s, v) => s + (Number(v) || 0), 0);
      sumKWh += dayKWh;

      if (mode === "rcem") {
        const y = Number(day.slice(0, 4));
        const m = Number(day.slice(5, 7));
        const rcem = clampPos(await getRCEm(req, y, m)); // PLN/MWh
        sumPLN += dayKWh * rcem * 0.001;
      } else {
        const rce = await getDayRCE(req, day); // [PLN/MWh x24]
        for (let i = 0; i < 24; i++) {
          const price = clampPos(Number(rce[i]) || 0); // ujemne ignorujemy
          const kwh = Number(gen[i]) || 0;
          sumPLN += kwh * price * 0.001;
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        from: days[0],
        to: days[days.length - 1],
        days: days.length,
        totals: {
          kwh: +sumKWh.toFixed(2),
          revenue_pln: +sumPLN.toFixed(2),
          mode: mode.toUpperCase(),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Compute failed" },
      { status: 200 }
    );
  }
}
