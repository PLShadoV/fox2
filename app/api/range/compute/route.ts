
import { NextRequest, NextResponse } from "next/server";

function parseDateFlexible(input: string): Date | null {
  if (!input) return null;
  const t = input.trim();
  const m1 = /^(\d{4})[-.\/](\d{2})[-.\/](\d{2})$/.exec(t);
  if (m1) {
    const y = +m1[1], M = +m1[2]-1, d = +m1[3];
    const dt = new Date(Date.UTC(y, M, d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const m2 = /^(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})$/.exec(t);
  if (m2) {
    const d = +m2[1], M = +m2[2]-1, y = +m2[3];
    const dt = new Date(Date.UTC(y, M, d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? null : dt;
}

function fmt(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number) {
  const dt = new Date(d.getTime());
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt;
}

async function pLimit<T>(limit: number, tasks: (() => Promise<T>)[]): Promise<T[]> {
  const out: T[] = [];
  let idx = 0;
  let active = 0;
  return new Promise((resolve, reject) => {
    const next = () => {
      if (idx >= tasks.length && active === 0) return resolve(out);
      while (active < limit && idx < tasks.length) {
        const cur = tasks[idx++]!;
        active++;
        cur().then((res) => {
          out.push(res);
        }).catch(reject).finally(() => {
          active--;
          next();
        });
      }
    };
    next();
  });
}

type Mode = "rce" | "rcem";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from") || "";
    const toStr   = searchParams.get("to") || "";
    const mode = (searchParams.get("mode") || "rce").toLowerCase() as Mode;

    const from = parseDateFlexible(fromStr);
    const to   = parseDateFlexible(toStr);
    if (!from || !to) {
      return NextResponse.json({ ok:false, error:"Invalid 'from' or 'to' date" }, { status: 200 });
    }
    if (to.getTime() < from.getTime()) {
      return NextResponse.json({ ok:false, error:"'to' must be >= 'from'" }, { status: 200 });
    }

    const days: Date[] = [];
    for (let d = new Date(from.getTime()); d.getTime() <= to.getTime(); d = addDays(d, 1)) {
      days.push(new Date(d.getTime()));
    }

    async function getJson(path: string) {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return res.json();
    }

    const results = await pLimit(2, days.map((d) => async () => {
      const date = fmt(d);
      let genSeries: number[] | null = null;
      try {
        const g1 = await getJson(`/api/foxess/day?date=${date}`);
        if (g1?.today?.generation?.series?.length) {
          genSeries = g1.today.generation.series as number[];
        } else if (Array.isArray(g1?.generationKWh)) {
          genSeries = g1.generationKWh as number[];
        } else if (Array.isArray(g1?.generation?.values)) {
          genSeries = g1.generation.values as number[];
        }
      } catch {}
      if (!genSeries) {
        try {
          const g2 = await getJson(`/api/foxess/history2?date=${date}`);
          if (Array.isArray(g2?.generation?.values)) {
            genSeries = g2.generation.values as number[];
          }
        } catch {}
      }
      if (!genSeries) genSeries = new Array(24).fill(0);

      const dayKWh = genSeries.reduce((a, b) => a + (Number(b) || 0), 0);
      let revenuePLN = 0;
      if (mode === "rce") {
        try {
          const r = await getJson(`/api/rce?date=${date}`);
          const rows: number[] = (r?.rows || r?.data || r?.sample || []).map((x: any) => {
            if (typeof x === "number") return x;
            if (x?.rce_pln_mwh != null) return +x.rce_pln_mwh;
            if (x?.price_pln_mwh != null) return +x.price_pln_mwh;
            return 0;
          });
          for (let i = 0; i < 24; i++) {
            const kwh = Number(genSeries[i] || 0);
            const price = Number(rows[i] || 0);
            const used = Math.max(price, 0);
            revenuePLN += kwh * used / 1000;
          }
        } catch {}
      } else {
        const ym = date.slice(0,7);
        try {
          const rc = await getJson(`/api/rcem?month=${ym}`);
          const price = Number(rc?.price ?? rc?.value ?? rc?.rcem);
          if (!isNaN(price)) revenuePLN = dayKWh * price / 1000;
        } catch {}
      }
      return { date, kWh: +dayKWh.toFixed(3), revenuePLN: +revenuePLN.toFixed(2) };
    }));

    const totalKWh = results.reduce((a, r) => a + r.kWh, 0);
    const totalRevenue = results.reduce((a, r) => a + r.revenuePLN, 0);

    return NextResponse.json({
      ok: true,
      mode,
      from: fmt(from),
      to: fmt(to),
      days: results,
      totals: { kWh: +totalKWh.toFixed(3), revenuePLN: +totalRevenue.toFixed(2) }
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 200 });
  }
}
