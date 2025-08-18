"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import StatTile from "@/components/StatTile";
import RangeButtons from "@/components/RangeButtons";
import PowerCurveCard from "@/components/PowerCurveCard";
import HourlyRevenueTable from "@/components/HourlyRevenueTable";
import RangeCalculator from "@/components/RangeCalculator";
import MonthlyRCEmTable from "@/components/MonthlyRCEmTable";
import ThemeToggle from "@/components/ThemeToggle";

type RevenueRow = {
  hour: number;
  kwh: number;
  price_pln_mwh: number;
  price_used_pln_mwh: number;
  revenue_pln: number;
};

type RevenuePayload = {
  rows: RevenueRow[];
  total: number | null;
};

async function getJSON<T = any>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function tryManyRealtime(urls: string[]) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" as any });
      if (r.ok) {
        const j = await r.json();
        if (j && typeof j.pvNowW === "number") return j;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export default function DashboardClient({ initialDate }: { initialDate?: string }) {
  const sp = useSearchParams();

  // UI / data state
  const [date, setDate] = useState<string>(initialDate || new Date().toISOString().slice(0, 10));
  const [calcMode, setCalcMode] = useState<"rce" | "rcem">("rce");
  const [pvNowW, setPvNowW] = useState<number | null>(null);
  const [genSeries, setGenSeries] = useState<number[]>(new Array(24).fill(0));
  const [revenue, setRevenue] = useState<RevenuePayload>({ rows: [], total: null });
  const [err, setErr] = useState<string | null>(null);

  const lastPv = useRef<number | null>(null);

  // Sync z ?date=
  useEffect(() => {
    const d = sp.get("date") || initialDate || new Date().toISOString().slice(0, 10);
    setDate(d);
  }, [sp, initialDate]);

  // Realtime co ~60s (z fallbackami endpointów)
  useEffect(() => {
    let alive = true;

    const fetchOnce = async () => {
      const j = await tryManyRealtime([
        `/api/foxess/realtime-cached`,
        `/api/foxess/realtime`,
        `/api/foxess?mode=realtime`,
        `/api/foxess/debug/realtime`,
      ]);
      if (!alive) return;
      lastPv.current = (j?.pvNowW ?? null) as number | null;
      setPvNowW(lastPv.current);
    };

    fetchOnce();
    const t = setInterval(fetchOnce, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // Pobranie generacji godzinowej i przychodu
  useEffect(() => {
    let cancelled = false;
    setErr(null);

    // 1) Generacja / eksport z danego dnia
    getJSON(`/api/foxess?date=${date}`)
      .then((j: any) => {
        if (cancelled) return;
        const series: number[] = Array.isArray(j?.generationKWh) ? j.generationKWh : [];
        setGenSeries(series);
      })
      .catch((e) => {
        if (!cancelled) setErr((prev) => prev || e.message);
      });

    // 2) Przychód (RCE/RCEm)
    getJSON(`/api/revenue/day?date=${date}&mode=${calcMode}`)
      .then((j: any) => {
        if (cancelled) return;
        const rows: RevenueRow[] = Array.isArray(j?.rows) ? j.rows : [];
        const total: number | null =
          typeof j?.totals?.revenue_pln === "number" ? j.totals.revenue_pln : null;
        setRevenue({ rows, total });
      })
      .catch((e) => {
        if (!cancelled) setErr((prev) => prev || e.message);
      });

    return () => {
      cancelled = false;
    };
  }, [date, calcMode]);

  // Prosta krzywa mocy z godzinowych kWh (interp. krok co 5 minut)
  const powerWave = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isToday = date === today;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const pts: { x: string; kw: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const prev = h > 0 ? Number(genSeries[h - 1] ?? 0) : 0;
      const cur = Number(genSeries[h] ?? 0);
      const steps = 12; // co 5 minut
      for (let s = 0; s < steps; s++) {
        const minute = h * 60 + s * 5;
        if (isToday && minute > nowMin) break;
        const t = (s + 1) / steps;
        const val = prev + (cur - prev) * t; // prosta interpo
        const hh = String(h).padStart(2, "0");
        const mm = String(s * 5).padStart(2, "0");
        // traktujemy kWh/h jako ~kW dla podglądu
        pts.push({ x: `${hh}:${mm}`, kw: Math.max(0, val) });
      }
    }
    if (isToday && pts.length && pvNowW != null) {
      const lastIdx = pts.length - 1;
      pts[lastIdx] = { x: pts[lastIdx].x, kw: Math.max(0, pvNowW / 1000) };
    }
    return pts;
  }, [genSeries, date, pvNowW]);

  const genTotal = useMemo(
    () => genSeries.reduce((a, b) => a + (Number(b) || 0), 0),
    [genSeries]
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight pv-title">FoxESS × RCE</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <div className="pv-toolbar">
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-80">Zakres:</span>
          <RangeButtons chipClass="pv-chip" activeClass="pv-chip--active" />
        </div>
      </div>

      {err ? (
        <div className="p-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          Wystąpił błąd: {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile
          label="Moc teraz"
          value={pvNowW != null ? `${pvNowW} W` : "—"}
          sub="Realtime z inwertera (60 s)"
        />
        <StatTile
          label="Wygenerowano (dzień)"
          value={`${genTotal.toFixed(1)} kWh`}
        />
        <div className="flex flex-col gap-2">
          <StatTile
            label="Przychód (dzień)"
            value={revenue.total != null ? `${revenue.total.toFixed(2)} PLN` : "—"}
            sub={calcMode === "rce" ? "RCE godzinowe" : "RCEm (średnia mies.)"}
          />
          <div className="self-end flex items-center gap-2 text-xs opacity-80">
            Tryb obliczeń:
            <button
              onClick={() => setCalcMode("rce")}
              className={"pv-chip " + (calcMode === "rce" ? "pv-chip--active" : "")}
            >
              RCE
            </button>
            <button
              onClick={() => setCalcMode("rcem")}
              className={"pv-chip " + (calcMode === "rcem" ? "pv-chip--active" : "")}
            >
              RCEm
            </button>
          </div>
        </div>
      </div>

      <PowerCurveCard
        title={`Moc [kW] — ${date}`}
        data={powerWave}
        xKey="x"
        yKey="kw"
        unit="kW"
      />

      <div className="space-y-2">
        <div className="text-sm opacity-80">
          Tabela godzinowa (generation, cena RCE/RCEm, przychód) — {date}
        </div>
        <HourlyRevenueTable rows={revenue.rows} />
      </div>

      <RangeCalculator />
      <MonthlyRCEmTable />
    </div>
  );
}
