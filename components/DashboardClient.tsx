"use client";

import { useEffect, useMemo, useState } from "react";
import StatTile from "@/components/StatTile";
import RangeButtons from "@/components/RangeButtons";
import BarChartCard from "@/components/BarChartCard";
import HourlyRevenueTable from "@/components/HourlyRevenueTable";

type RevenueRow = { hour:number;kwh:number;price_pln_mwh:number;price_used_pln_mwh:number;revenue_pln:number; };

async function getJSON(path: string){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch ${path} failed: ${res.status}`);
  return res.json();
}

export default function DashboardClient({ initialDate }: { initialDate: string }){
  const [date, setDate] = useState(initialDate);
  const [pvNowW, setPvNowW] = useState<number|null>(null);
  const [genTotal, setGenTotal] = useState<number|null>(null);
  const [revenue, setRevenue] = useState<{ rows: RevenueRow[], total: number|null }>({
    rows: [], total: null
  });
  const [err, setErr] = useState<string| null>(null);

  const hourly = useMemo(()=> (revenue.rows || []).map(r=>({ x: String(r.hour).padStart(2,"0")+":00", revenue: r.revenue_pln })), [revenue.rows]);

  useEffect(()=>{
    let cancelled = false;
    setErr(null);

    // 1) realtime
    getJSON(`/api/foxess/realtime`)
      .then(j => { if (!cancelled) setPvNowW(j?.pvNowW ?? null); })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    // 2) day summary
    getJSON(`/api/foxess/summary/day?date=${date}`)
      .then(j => { if (!cancelled) setGenTotal(j?.today?.generation?.total ?? null); })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    // 3) revenue
    getJSON(`/api/revenue/day?date=${date}`)
      .then(j => { if (!cancelled) setRevenue({ rows: j?.rows || [], total: j?.totals?.revenue_pln ?? null }); })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    return ()=> { cancelled = true; }
  }, [date]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">PV Dashboard</h1>
        <RangeButtons />
      </div>

      {err ? (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          Wystąpił błąd podczas pobierania danych: {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Moc teraz" value={pvNowW != null ? `${pvNowW} W` : "—"} />
        <StatTile label="Wygenerowano (ten dzień)" value={genTotal != null ? `${genTotal.toFixed(1)} kWh` : "—"} />
        <StatTile label="Dzisiejszy przychód" value={revenue.total != null ? `${revenue.total.toFixed(2)} PLN` : "—"} sub="Liczony z GENERATION × max(RCE,0)/1000" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard title={`Przychód na godzinę — ${date}`} data={hourly} xKey="x" yKey="revenue" formatter={(v)=> `${v} PLN`} />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-zinc-500">Tabela godzinowa (generation, cena RCE, przychód) — {date}</div>
        <HourlyRevenueTable rows={revenue.rows} />
      </div>
    </div>
  );
}
