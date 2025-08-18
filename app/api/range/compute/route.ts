// app/api/range/compute/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** utils */
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

/** akceptujemy YYYY-MM-DD lub DD.MM.RRRR */
function parseDateLoose(input: string | null): Date | null {
  if (!input) return null;
  const s = input.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD.MM.RRRR
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split(".");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function getJSON<T>(req: NextRequest, path: string): Promise<T | null> {
  try {
    const url = new URL(path, req.url);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Pobranie godzinowej generacji (kWh) dla dnia (24 liczby). */
async function getGenerationKwhForDay(
  req: NextRequest,
  date: string
): Promise<number[]> {
  // kolejność prób – bierzemy cokolwiek zwróci sensowne dane
  const candidates = [
    `/api/foxess/day?date=${date}`,
    `/api/foxess?date=${date}`,
    `/api/foxess/debug/history2?date=${date}`,
    `/api/foxess/debug/history?date=${date}`,
  ];

  for (const p of candidates) {
    const data: any = await getJSON<any>(req, p);
    if (!data) continue;

    // kilka możliwych kształtów odpowiedzi
    // 1) { ok:true, today:{ generation:{ series:[...], unit:'kWh' } } }
    const s1 = data?.today?.generation?.series;
    if (Array.isArray(s1) && s1.length) {
      return normalize24(s1);
    }

    // 2) { ok:true, generation:{ values:[...], unit:'kWh' } }
    const s2 = data?.generation?.values;
    if (Array.isArray(s2) && s2.length) {
      return normalize24(s2);
    }

    // 3) FoxESS raw: { result:[ { variable:'generation', unit:'kWh', values:[...]}, ...] }
    const arr = data?.result;
    if (Array.isArray(arr)) {
      const hit =
        arr.find((x: any) =>
          (x?.variable || "").toString().toLowerCase().includes("generation")
        ) || arr.find((x: any) => (x?.variable || "").toString().toLowerCase().includes("eday"));
      const vals = hit?.values;
      if (Array.isArray(vals) && vals.length) {
        return normalize24(vals);
      }
    }

    // 4) { ok:true, values:{ generationKWh:[...] } }
    const s4 = data?.values?.generationKWh;
    if (Array.isArray(s4) && s4.length) {
      return normalize24(s4);
    }
  }

  // brak danych = same zera
  return new Array(24).fill(0);
}

/** Pobranie godzinowych RCE (PLN/MWh) – 24 liczby. */
async function getHourlyRCE(
  req: NextRequest,
  date: string
): Promise<number[]> {
  const data: any =
    (await getJSON<any>(req, `/api/rce?date=${date}`)) ??
    (await getJSON<any>(req, `/api/rce-pln?date=${date}`));

  if (!data) return new Array(24).fill(0);

  // Warianty kształtów odpowiedzi:
  // a) { ok:true, rows:[{rce_pln_mwh:...} x24] }
  if (Array.isArray(data?.rows) && data.rows.length) {
    return normalize24(
      data.rows.map((r: any) => Number(r?.rce_pln_mwh ?? 0))
    );
  }
  // b) { ok:true, count:24, sample:[{rce_pln_mwh:...}] }
  if (Array.isArray(data?.sample) && data.sample.length) {
    return normalize24(
      data.sample.map((r: any) => Number(r?.rce_pln_mwh ?? 0))
    );
  }
  // c) inne: spróbuj keys->values
  const arr: any[] = data?.values || data?.hours || [];
  if (Array.isArray(arr) && arr.length) {
    return normalize24(arr.map((v: any) => Number(v ?? 0)));
  }

  return new Array(24).fill(0);
}

/** RCEm (PLN/MWh) dla YYYY-MM – najpierw /api/rcem?month=..., fallback: średnia z godzinowego RCE w miesiącu. */
async function getRCEmForMonth(
  req: NextRequest,
  year: number,
  month1to12: number
): Promise<number> {
  const ym = `${year}-${pad2(month1to12)}`;

  // 1) próbuj dedykowany endpoint
  const rcemRes: any = await getJSON<any>(req, `/api/rcem?month=${ym}`);
  const direct =
    Number(rcemRes?.value_pln_mwh) ||
    Number(rcemRes?.rcem_pln_mwh) ||
    Number(rcemRes?.value);
  if (direct && isFinite(direct)) return direct;

  // 2) fallback – licz średnią z godzinowego RCE dla całego miesiąca
  const first = new Date(Date.UTC(year, month1to12 - 1, 1));
  const next = new Date(Date.UTC(year, month1to12, 1));
  const days: string[] = [];
  for (let d = new Date(first); d < next; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(ymd(d));
  }
  const allHours: number[] = [];
  // Ogranicz równoległość (żeby nie „zalać” PSE), prosta kolejka:
  for (const day of days) {
    const rce = await getHourlyRCE(req, day);
    allHours.push(...rce);
  }
  if (!allHours.length) return 0;
  const avg =
    allHours.reduce((acc, v) => acc + (isFinite(v) ? v : 0), 0) /
    allHours.length;
  return Number(avg.toFixed(2));
}

/** Wyrównaj/uciąć do 24 elementów i konwersja na number */
function normalize24(arr: any[]): number[] {
  const out = new Array(24).fill(0);
  for (let i = 0; i < 24; i++) {
    const v = Number(arr[i] ?? 0);
    out[i] = isFinite(v) ? v : 0;
  }
  return out;
}

function clampNonNegative(n: number) {
  return n < 0 || !isFinite(n) ? 0 : n;
}

type Mode = "rce" | "rcem";

/** GŁÓWNY HANDLER */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    const mode = (url.searchParams.get("mode") || "rce").toLowerCase() as Mode;

    const from = parseDateLoose(fromRaw);
    const to = parseDateLoose(toRaw);

    if (!from || !to) {
      return NextResponse.json(
        { ok: false, error: "Invalid 'from' or 'to' date" },
        { status: 400 }
      );
    }
    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { ok: false, error: "'from' is after 'to'" },
        { status: 400 }
      );
    }

    // twarde ograniczenie zakresu (np. 400 dni), żeby nie przeciążyć
    const MAX_DAYS = 400;
    const days: Date[] = [];
    const cur = new Date(from);
    while (cur.getTime() <= to.getTime()) {
      days.push(new Date(cur));
      if (days.length > MAX_DAYS) break;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (days.length > MAX_DAYS) {
      return NextResponse.json(
        { ok: false, error: `Range too long (>${MAX_DAYS} days)` },
        { status: 400 }
      );
    }

    // cache RCEm dla miesiąca, aby nie liczyć wielokrotnie
    const rcemCache = new Map<string, number>();

    let sumKWh = 0;
    let sumPLN = 0;

    for (const d of days) {
      const dateStr = ymd(d);

      const gen = await getGenerationKwhForDay(req, dateStr); // 24 kWh
      const dayKWh = gen.reduce((a, b) => a + (isFinite(b) ? b : 0), 0);
      sumKWh += dayKWh;

      if (mode === "rce") {
        const rce = await getHourlyRCE(req, dateStr); // 24 PLN/MWh
        for (let h = 0; h < 24; h++) {
          const kwh = Number(gen[h] ?? 0);
          const price = clampNonNegative(Number(rce[h] ?? 0));
          // kWh * (PLN/MWh) / 1000 => PLN
          sumPLN += (isFinite(kwh) ? kwh : 0) * price * 0.001;
        }
      } else {
        // RCEm – cena miesięczna
        const ymKey = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
        let monthPrice = rcemCache.get(ymKey);
        if (monthPrice == null) {
          monthPrice = await getRCEmForMonth(
            req,
            d.getUTCFullYear(),
            d.getUTCMonth() + 1
          );
          rcemCache.set(ymKey, monthPrice);
        }
        const priceUsed = clampNonNegative(Number(monthPrice || 0));
        sumPLN += dayKWh * priceUsed * 0.001;
      }
    }

    // 2 miejsca po przecinku dla PLN, 2 dla kWh (możesz zmienić)
    const result = {
      ok: true,
      mode,
      from: ymd(from),
      to: ymd(to),
      days: days.length,
      sum_kwh: Number(sumKWh.toFixed(2)),
      revenue_pln: Number(sumPLN.toFixed(2)),
      meta: {
        note:
          mode === "rce"
            ? "Przychód = suma(godziny: KWh * max(RCE,0)/1000)"
            : "Przychód = suma(dni: KWh_dnia * max(RCEm,0)/1000)",
      },
    };

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
