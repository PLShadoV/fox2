"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatTile from "@/components/StatTile";
import RangeButtons from "@/components/RangeButtons";
import AreaChartCard from "@/components/AreaChartCard";
import HourlyRevenueTable from "@/components/HourlyRevenueTable";
import RangeCalculator from "@/components/RangeCalculator";
import MonthlyRCEmTable from "@/components/MonthlyRCEmTable";

type RevenueRow = { hour:number;kwh:number;price_pln_mwh:number;price_used_pln_mwh:number;revenue_pln:number; };

async function getJSON(path: string){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch ${path} failed: ${res.status}`);
  return res.json();
}
async function tryManyRealtime(paths: string[]){
  for (const p of paths){
    try {
      const j = await getJSON(p);
      if (j && j.pvNowW != null) return j;
    } catch{ /* try next */ }
  }
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
  const [calcMode, setCalcMode] = useState<"rce"|"rcem">("rce");
  const [err, setErr] = useState<string| null>(null);

  // Sync with URL (?date=...)
  useEffect(()=>{
    const d = sp.get("date") || initialDate || new Date().toISOString().slice(0,10);
    setDate(d);
  }, [sp, initialDate]);

  useEffect(()=>{
    let cancelled = false;
    setErr(null);

    tryManyRealtime([
      `/api/foxess/realtime-cached`,
      `/api/foxess/realtime`,
      `/api/foxess?mode=realtime`
    ]).then(j => { if (!cancelled) setPvNowW(j?.pvNowW ?? null); })
      .catch(_ => { if (!cancelled) setPvNowW(null); });

    getJSON(`/api/foxess/summary/day-cached?date=${date}`)
      .then(j => {
        if (cancelled) return;
        const total = j?.today?.generation?.total ?? null;
        const series = j?.today?.generation?.series ?? [];
        setGenTotal(total);
        setGenSeries(Array.isArray(series) ? series : []);
      })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    getJSON(`/api/revenue/day?date=${date}&mode=${calcMode}`)
      .then(j => { if (!cancelled) setRevenue({ rows: j?.rows || [], total: j?.totals?.revenue_pln ?? null }); })
      .catch(e => { if (!cancelled) setErr(prev => prev || e.message); });

    return ()=> { cancelled = true; }
  }, [date, calcMode]);

  // Build "wave" curve: cumulative kWh every 5 minutes, trimmed to now for today
  const genWave = useMemo(()=>{
    const today = new Date().toISOString().slice(0,10);
    const isToday = date === today;
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();
    const points: {x:string, kwh:number}[] = [];
    let cum = 0;
    for (let h=0; h<24; h++){
      const val = Number(genSeries[h] ?? 0); // kWh in hour h
      const steps = 12; // 5-min
      for (let s=0; s<steps; s++){
        const minute = h*60 + s*5;
        if (isToday && minute > nowMin) break;
        const frac = (s+1)/steps;
        const cur = cum + val * frac;
        const hh = String(h).padStart(2,"0");
        const mm = String((s+1)*5).padStart(2,"0");
        points.push({ x: `${hh}:${mm}`, kwh: Number(cur.toFixed(2)) });
      }
      cum += val;
    }
    return points;
  }, [genSeries, date]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight text-sky-900">PV Dashboard</h1>
        <div className="flex items-center gap-2">
          <a href="https://www.foxesscloud.com" target="_blank" className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm hover:bg-white/70 transition glass-focus">FoxESS</a>
          <a href="https://raporty.pse.pl/report/rce-pln" target="_blank" className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm hover:bg-white/70 transition glass-focus">RCE (PSE)</a>
          <RangeButtons />
        </div>
      </div>

      {err ? <div className="p-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 text-sm">Wystąpił błąd: {err}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Moc teraz" value={pvNowW != null ? `${pvNowW} W` : "—"} sub="Realtime z inwertera" />
        <StatTile label="Wygenerowano (dzień)" value={genTotal != null ? `${genTotal.toFixed(1)} kWh` : "—"} />
        <div className="flex flex-col gap-2">
          <StatTile label="Przychód (dzień)" value={revenue.total != null ? `${revenue.total.toFixed(2)} PLN` : "—"} sub={calcMode === "rce" ? "RCE godzinowe" : "RCEm (średnia mies.)"} />
          <div className="self-end flex items-center gap-2 text-xs text-sky-900/70">
            Tryb obliczeń:
            <button onClick={()=> setCalcMode("rce")} className={"px-3 py-1 rounded-xl border " + (calcMode==="rce" ? "bg-sky-500 text-white border-sky-500" : "bg-white/60 border-white/30")}>RCE</button>
            <button onClick={()=> setCalcMode("rcem")} className={"px-3 py-1 rounded-xl border " + (calcMode==="rcem" ? "bg-sky-500 text-white border-sky-500" : "bg-white/60 border-white/30")}>RCEm</button>
          </div>
        </div>
      </div>

      <AreaChartCard title={`Skumulowana generacja — ${date}`} data={genWave} xKey="x" yKey="kwh" suffix=" kWh" decimals={2} />

      <div className="space-y-2">
        <div className="text-sm text-sky-900/70">Tabela godzinowa (generation, cena RCE/RCEm, przychód) — {date}</div>
        <HourlyRevenueTable rows={revenue.rows} />
      </div>

      <RangeCalculator />

      <MonthlyRCEmTable />
    </div>
  );
}
