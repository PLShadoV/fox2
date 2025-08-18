"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatTile from "@/components/StatTile";
import RangeButtons from "@/components/RangeButtons";
import AreaChartCard from "@/components/AreaChartCard";
import HourlyRevenueTable from "@/components/HourlyRevenueTable";
import RangeCalculator from "@/components/RangeCalculator";

type RevenueRow = { hour:number;kwh:number;price_pln_mwh:number;price_used_pln_mwh:number;revenue_pln:number; };

async function getJSON(path: string){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch ${path} failed: ${res.status}`);
  return res.json();
}
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
  const [calcMode, setCalcMode] = useState<"rce"|"rcem">("rce"); // toggle RCE vs RCEm
  const [err, setErr] = useState<string| null>(null);
  const [warn, setWarn] = useState<string| null>(null);

  // Sync with URL (?date=...)
  useEffect(()=>{
    const d = sp.get("date") || initialDate || new Date().toISOString().slice(0,10);
    setDate(d);
  }, [sp, initialDate]);

  // Fetch data on date or mode change
  useEffect(()=>{
    let cancelled = false;
    setErr(null);
    setWarn(null);

    // realtime (graceful if 404)
    tryManyRealtime([
      `/api/foxess/realtime`,
      `/api/foxess?mode=realtime`,
      `/api/foxess`,
      `/api/foxess/debug/realtime`,
      `/api/foxess/debug/realtime-now`
    ]).then(j => { if (!cancelled) setPvNowW(j?.pvNowW ?? null); })
      .catch(_ => { if (!cancelled) setWarn("Brak realtime – kafelek pokaże —"); });

    // day summary (generation totals + hourly series)
    getJSON(`/api/foxess/summary/day?date=${date}`)
      .then(j => {
        if (cancelled) return;
        const total = j?.today?.generation?.total ?? null;
        const series = j?.today?.generation?.series ?? [];
        setGenTotal(total);
        setGenSeries(Array.isArray(series) ? series : []);
      })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    // revenue table/tile (supports mode=rce/rcem)
    getJSON(`/api/revenue/day?date=${date}&mode=${calcMode}`)
      .then(j => { if (!cancelled) setRevenue({ rows: j?.rows || [], total: j?.totals?.revenue_pln ?? null }); })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    return ()=> { cancelled = true; }
  }, [date, calcMode]);

  // Area chart data: hourly generation
  const genHourly = useMemo(()=> {
    const out = [];
    for (let h=0; h<24; h++){
      const kwh = Number(genSeries[h] ?? 0);
      out.push({ x: String(h).padStart(2,"0")+":00", kwh });
    }
    return out;
  }, [genSeries]);

  const todayISO = new Date().toISOString().slice(0,10);
  const isToday = date === todayISO;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-sky-900">PV Dashboard</h1>
        <div className="flex items-center gap-2">
          {/* External links */}
          <a href="https://www.foxesscloud.com" target="_blank" className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm hover:bg-white/70 transition glass-focus">FoxESS</a>
          <a href="https://raporty.pse.pl/report/rce-pln" target="_blank" className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm hover:bg-white/70 transition glass-focus">RCE (PSE)</a>
          <RangeButtons />
        </div>
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
        <StatTile label="Moc teraz" value={isToday ? (pvNowW != null ? `${pvNowW} W` : "—") : "—"} sub={isToday ? undefined : "Realtime tylko dla dzisiaj"} />
        <StatTile label="Wygenerowano (dzień)" value={genTotal != null ? `${genTotal.toFixed(1)} kWh` : "—"} />
        <div className="flex flex-col gap-2">
          <StatTile label="Przychód (dzień)" value={revenue.total != null ? `${revenue.total.toFixed(2)} PLN` : "—"} sub={calcMode === "rce" ? "RCE godzinowe" : "RCEm (średnia mies.)"} />
          <div className="self-end flex items-center gap-2 text-xs text-sky-900/70">
            Tryb obliczeń:
            <button
              onClick={()=> setCalcMode("rce")}
              className={"px-3 py-1 rounded-xl border " + (calcMode==="rce" ? "bg-sky-500 text-white border-sky-500" : "bg-white/60 border-white/30")}
            >RCE</button>
            <button
              onClick={()=> setCalcMode("rcem")}
              className={"px-3 py-1 rounded-xl border " + (calcMode==="rcem" ? "bg-sky-500 text-white border-sky-500" : "bg-white/60 border-white/30")}
            >RCEm</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AreaChartCard title={`Generacja (kWh) na godzinę — ${date}`} data={genHourly} xKey="x" yKey="kwh" suffix=" kWh" decimals={2} />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-sky-900/70">Tabela godzinowa (generation, cena RCE, przychód) — {date}</div>
        <HourlyRevenueTable rows={revenue.rows} />
      </div>

      <RangeCalculator />
    </div>
  );
}
