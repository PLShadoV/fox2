
"use server";

import { NextRequest, NextResponse } from "next/server";

/**
 * /api/range/compute?from=YYYY-MM-DD&to=YYYY-MM-DD&mode=rce|rcem
 * - Sumuje GENERATION (kWh) i przychód dla zakresu dat.
 * - Przychód w trybie:
 *    rce  -> suma godzin: kWh[h] * max(RCE[h],0) / 1000
 *    rcem -> suma dnia:  kWh[dzień] * RCEm(YYYY-MM) / 1000
 * - Ograniczenie: max 93 dni na zapytanie.
 * - Limit zapytań równoległych do 4 oraz timeout pojedynczego fetchu 7.5 s.
 */

type RceHour = { timeISO?: string; rce_pln_mwh?: number; price?: number };
type FoxDay = { series?: number[]; values?: number[]; total?: number; unit?: string };

const MAX_DAYS = 93;
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 7500;

// bardzo prosty cache w pamięci procesu (Vercel może go zresetować między wywołaniami)
const memCache = new Map<string, { t: number; data: any }>();
const TTL_MS = 1000 * 60 * 10; // 10 min

function getCache<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.t > TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCache(key: string, data: any) {
  memCache.set(key, { t: Date.now(), data });
}

function parseDateOnly(s?: string | null): string | null {
  if (!s) return null;
  // akceptujemy dokładnie YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // walidacja "rozsądna" (np. 2025-02-30 odpadnie)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

function addDays(dateStr: string, add: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + add);
  return dt.toISOString().slice(0, 10);
}

async function fetchWithTimeout(url: string): Promise<any> {
  const cacheKey = `fwt:${url}`;
  const hit = getCache<any>(cacheKey);
  if (hit) return hit;

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "force-cache", signal: ac.signal, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
    const json = await res.json();
    setCache(cacheKey, json);
    return json;
  } finally {
    clearTimeout(to);
  }
}

// prosta kolejka z limitem równoległości
async function runBatched<T, R>(items: T[], limit: number, worker: (x: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as any;
  let idx = 0;
  let active = 0;
  let resolve!: (v: R[]) => void;
  let reject!: (e: any) => void;
  const done = new Promise<R[]>((res, rej) => { resolve = res; reject = rej; });

  const kick = () => {
    if (idx >= items.length && active === 0) return resolve(out);
    while (active < limit && idx < items.length) {
      const i = idx++;
      active++;
      Promise.resolve(worker(items[i], i))
        .then((r) => { out[i] = r; active--; kick(); })
        .catch((e) => { reject(e); });
    }
  };
  kick();
  return done;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function clampNonNegative(x: number): number {
  return x > 0 ? x : 0;
}

function monthKey(dateStr: string): string {
  // YYYY-MM
  return dateStr.slice(0, 7);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromRaw = parseDateOnly(searchParams.get("from"));
    const toRaw   = parseDateOnly(searchParams.get("to"));
    const mode = (searchParams.get("mode") || "rce").toLowerCase();

    if (!fromRaw || !toRaw) {
      return NextResponse.json({ ok: false, error: "Invalid 'from' or 'to' date" }, { status: 400 });
    }
    if (fromRaw > toRaw) {
      return NextResponse.json({ ok: false, error: "'from' must be <= 'to'" }, { status: 400 });
    }

    // policz ile dni
    let days = 1;
    for (let cur = fromRaw; cur < toRaw; cur = addDays(cur, 1)) days++;
    if (days > MAX_DAYS) {
      return NextResponse.json({ ok: false, error: `Zakres zbyt duży (max ${MAX_DAYS} dni)` }, { status: 400 });
    }

    // przygotuj listę dat
    const dates: string[] = [];
    for (let cur = fromRaw; ; cur = addDays(cur, 1)) {
      dates.push(cur);
      if (cur === toRaw) break;
    }

    // pobierz RCEm miesięcznie (grupujemy, żeby nie uderzać po kilka razy)
    const months = Array.from(new Set(dates.map(monthKey)));
    const rcemByMonth: Record<string, number> = {};
    if (mode === "rcem") {
      await runBatched(months, 2, async (m) => {
        const rcemUrl = `/api/rcem?month=${m}`; // zakładamy, że masz taki endpoint (jeśli nie — napisz, dopasuję do Twojego)
        const data = await fetchWithTimeout(rcemUrl);
        // fallback: różne struktury
        let price = 0;
        if (data?.ok && (data.price !== undefined)) price = Number(data.price);
        else if (Array.isArray(data?.rows) && data.rows.length > 0) price = Number(data.rows[0].rcem_pln_mwh || data.rows[0].price);
        rcemByMonth[m] = Number.isFinite(price) ? price : 0;
        return 0 as any;
      });
    }

    // policz dzień po dniu (równolegle do 4 wątków)
    type DayRow = { date: string; kwh: number; revenuePLN: number };
    const daily: DayRow[] = await runBatched(dates, CONCURRENCY, async (d) => {
      // 1) GENERATION (z naszego backendu, żeby nie zdradzać sekretów FoxESS)
      const foxUrl = `/api/foxess/day?date=${d}`;
      const fox = await fetchWithTimeout(foxUrl);

      // postać 1 (Twoje ostatnie JSON-y): { ok:true, today:{generation:{series:[...], total}} }
      // postać 2 (fallback): { result:[{variable:"generation", values:[...]}] }
      let genSeries: number[] | undefined;
      let genTotal: number | undefined;

      if (fox?.ok && fox?.today?.generation) {
        genSeries = Array.isArray(fox.today.generation.series) ? fox.today.generation.series.map((x:any) => +x || 0) : undefined;
        genTotal = Number(fox.today.generation.total);
      }
      if (!genSeries && Array.isArray(fox?.result)) {
        const g = fox.result.find((r:any) => (r.variable||"").toLowerCase().includes("gen"));
        if (g?.values) genSeries = g.values.map((x:any)=> +x || 0);
      }

      if (!genSeries) genSeries = [];
      if (!Number.isFinite(genTotal)) genTotal = sum(genSeries);

      let revenue = 0;
      if (mode === "rce") {
        // 2) RCE dzień (godzinowy)
        const rceUrl = `/api/rce?date=${d}`;
        const rce = await fetchWithTimeout(rceUrl);
        let hours: number[] = [];
        if (Array.isArray(rce?.rows)) {
          hours = rce.rows.map((r: RceHour) => Number(r.rce_pln_mwh ?? r.price ?? 0));
        } else if (Array.isArray(rce)) {
          hours = rce.map((r: any) => Number(r.rce_pln_mwh ?? r.price ?? 0));
        }
        // dopasowanie długości (czasem FoxESS zwraca mniej punktów)
        const n = Math.min(genSeries.length, hours.length);
        for (let i=0;i<n;i++){
          const kwh = +genSeries[i] || 0;
          const price = clampNonNegative(+hours[i] || 0);
          revenue += kwh * (price / 1000);
        }
      } else { // RCEm
        const m = monthKey(d);
        const price = clampNonNegative(rcemByMonth[m] ?? 0);
        revenue = (genTotal || 0) * (price / 1000);
      }

      return { date: d, kwh: +(genTotal || 0).toFixed(2), revenuePLN: +revenue.toFixed(2) };
    });

    const totalKWh = +daily.reduce((a, r) => a + r.kwh, 0).toFixed(2);
    const totalPLN = +daily.reduce((a, r) => a + r.revenuePLN, 0).toFixed(2);

    return NextResponse.json({
      ok: true,
      mode,
      from: fromRaw,
      to: toRaw,
      days: daily.length,
      total: { kwh: totalKWh, revenuePLN: totalPLN },
      daily
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
