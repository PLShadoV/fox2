"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

// Try many endpoints; pick the first that returns a NON-null pvNowW
async function tryManyRealtime(paths: string[]){
  let last404 = false;
  for (const p of paths){
    try {
      const j = await getJSON(p);
      if (j && j.pvNowW != null) return j;
    } catch(e:any){
      const is404 = /404/.test(String(e));
      last404 = last404 || is404;
      if (!is404) throw e;
    }
  }
  if (last404) throw new Error("Realtime endpoint not found (404)");
  throw new Error("Realtime data unavailable");
}

export default function DashboardClient({ initialDate }: { initialDate: string }){
  const sp = useSearchParams();
  const [date, setDate] = useState(initialDate);
  const [pvNowW, setPvNowW] = useState<number|null>(null);
  const [genTotal, setGenTotal] = useState<number|null>(null);
  const [genSeries, setGenSeries] = useState<number[]>([]);
  const [revenue, setRevenue] = useState<{ rows: RevenueRow[], total: number|null }>({
    rows: [], total: null
  });
  const [err, setErr] = useState<string| null>(null);
  const [warn, setWarn] = useState<string| null>(null);

  useEffect(()=>{
    const d = sp.get("date") || initialDate || new Date().toISOString().slice(0,10);
    setDate(d);
  }, [sp, initialDate]);

  useEffect(()=>{
    let cancelled = false;
    setErr(null);
    setWarn(null);

    tryManyRealtime([
      `/api/foxess/realtime`,
      `/api/foxess?mode=realtime`,
      `/api/foxess`,
      `/api/foxess/debug/realtime`,
      `/api/foxess/debug/realtime-now`
    ]).then(j => { if (!cancelled) setPvNowW(j?.pvNowW ?? null); })
      .catch(_ => { if (!cancelled) setWarn("Brak realtime – kafelek pokaże —"); });

    getJSON(`/api/foxess/summary/day?date=${date}`)
      .then(j => {
        if (cancelled) return;
        const total = j?.today?.generation?.total ?? null;
        const series = j?.today?.generation?.series ?? [];
        setGenTotal(total);
        setGenSeries(Array.isArray(series) ? series : []);
      })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    getJSON(`/api/revenue/day?date=${date}`)
      .then(j => { if (!cancelled) setRevenue({ rows: j?.rows || [], total: j?.totals?.revenue_pln ?? null }); })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    return ()=> { cancelled = true; }
  }, [date]);

  const genHourly = useMemo(()=> {
    const out = [];
    for (let h=0; h<24; h++){
      const kwh = Number(genSeries[h] ?? 0);
      out.push({ x: String(h).padStart(2,"0")+":00", kwh });
    }
    return out;
  }, [genSeries]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-sky-900">PV Dashboard</h1>
        <RangeButtons />
      </div>

      {err ? (
        <div className="p-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">
          Wystąpił błąd podczas pobierania danych: {err}
        </div>
      ) : null}

      {warn ? (
        <div className="p-3 rounded-2xl border border-sky-200 bg-sky-50 text-sky-800 text-xs">
          {warn}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Moc teraz" value={pvNowW != null ? `${pvNowW} W` : "—"} />
        <StatTile label="Wygenerowano (dzień)" value={genTotal != null ? `${genTotal.toFixed(1)} kWh` : "—"} />
        <StatTile label="Przychód (dzień)" value={revenue.total != null ? `${revenue.total.toFixed(2)} PLN` : "—"} sub="GENERATION × max(RCE,0)/1000" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard title={`Generacja (kWh) na godzinę — ${date}`} data={genHourly} xKey="x" yKey="kwh" suffix=" kWh" decimals={2} />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-sky-900/70">Tabela godzinowa (generation, cena RCE, przychód) — {date}</div>
        <HourlyRevenueTable rows={revenue.rows} />
      </div>
    </div>
  );
}
