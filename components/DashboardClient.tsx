"use client";

import React, { useEffect, useMemo, useState } from "react";
import StatTile from "./StatTile";
import PowerChart from "./PowerChart";

type Mode = "rce" | "rcem";

type FoxDayResp = {
  ok: boolean;
  date: string;
  today?: {
    generation: { unit: "kWh"; series: number[]; total: number; toNow: number; variable: string };
    export?: any;
  };
  error?: string;
};

type RealtimeResp = {
  ok: boolean;
  pvNowW?: number | null;
};

type RceRevenue = {
  ok: boolean;
  unit: "kWh";
  rows: Array<{ hour: number; kwh: number; price_pln_mwh: number; revenue_pln: number }>;
  totals: { kwh: number; revenue_pln: number };
};

type RcemRevenue = {
  ok: boolean;
  generation_kwh: number;
  revenue_pln: number;
};

export default function DashboardClient({ initialDate }: { initialDate?: string }) {
  const [date, setDate] = useState<string>(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [mode, setMode] = useState<Mode>("rce");
  const [pvNowW, setPvNowW] = useState<number | null>(null);
  const [genDay, setGenDay] = useState<number | null>(null);
  const [revenueDay, setRevenueDay] = useState<number | null>(null);
  const [powerPoints, setPowerPoints] = useState<{ t: string; kw: number }[]>([]);

  // Fetch realtime every 60s (independent of selected date)
  useEffect(() => {
    let timer: any;
    const hit = async () => {
      try {
        const r = await fetch("/api/foxess/realtime", { cache: "no-store" });
        const j: RealtimeResp = await r.json();
        setPvNowW(j.pvNowW ?? null);
      } catch {
        setPvNowW(null);
      }
    };
    hit();
    timer = setInterval(hit, 60000);
    return () => clearInterval(timer);
  }, []);

  // Day generation + power/curve
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/foxess/day?date=${date}`, { cache: "no-store" });
        const j: FoxDayResp = await r.json();
        if (j.ok && j.today) {
          setGenDay(j.today.generation.total ?? 0);

          // Try dedicated power endpoint first
          let ok = false;
          try {
            const rr = await fetch(`/api/foxess/power?date=${date}`, { cache: "no-store" });
            const pj = await rr.json();
            if (pj && pj.ok && Array.isArray(pj.points)) {
              const pts = pj.points.map((p: any) => ({
                t: p.time?.slice(11, 16) ?? p.t ?? "",
                kw: Number(p.kw ?? p.powerKw ?? 0),
              }));
              setPowerPoints(pts);
              ok = true;
            }
          } catch {}
          if (!ok) {
            // Fallback: build a smooth-ish curve from hourly kWh (derivative)
            const series = j.today.generation.series || [];
            const pts: { t: string; kw: number }[] = [];
            for (let h = 0; h < 24; h++) {
              const kwh = Number(series[h] || 0);
              const kw = Math.max(0, kwh); // approx: treat kWh in hour as mean kW
              const hh = String(h).padStart(2, "0");
              pts.push({ t: `${hh}:00`, kw });
              pts.push({ t: `${hh}:30`, kw }); // flatten half-hour to avoid spikes
            }
            setPowerPoints(pts);
          }
        } else {
          setGenDay(0);
          setPowerPoints([]);
        }
      } catch {
        setGenDay(null);
        setPowerPoints([]);
      }
    })();
  }, [date]);

  // Revenue (day)
  useEffect(() => {
    (async () => {
      try {
        if (mode === "rce") {
          const r = await fetch(`/api/revenue/day?date=${date}`, { cache: "no-store" });
          const j: RceRevenue = await r.json();
          setRevenueDay(j?.totals?.revenue_pln ?? 0);
        } else {
          const r = await fetch(`/api/rcem/revenue?from=${date}&to=${date}`, { cache: "no-store" });
          const j: RcemRevenue = await r.json();
          setRevenueDay(j?.revenue_pln ?? 0);
        }
      } catch {
        setRevenueDay(null);
      }
    })();
  }, [date, mode]);

  const todayStr = useMemo(() => new Date(date).toLocaleDateString(), [date]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* top row */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <a className="chip" href="https://www.foxesscloud.com" target="_blank">FoxESS</a>
        <a className="chip" href="https://raporty.pse.pl/report/rce-pln" target="_blank">RCE (PSE)</a>

        <button className="chip" onClick={() => setDate(new Date().toISOString().slice(0,10))}>Dziś</button>
        <button className="chip" onClick={() => {
          const d = new Date(date); d.setDate(d.getDate()-1);
          setDate(d.toISOString().slice(0,10));
        }}>Wczoraj</button>

        <input
          className="chip-input"
          type="date"
          value={date}
          onChange={(e)=>setDate(e.target.value)}
        />

        <div className="ml-auto flex items-center gap-2">
          <span>Tryb obliczeń:</span>
          <button className={`chip ${mode==="rce"?"chip--active":""}`} onClick={()=>setMode("rce")}>RCE</button>
          <button className={`chip ${mode==="rcem"?"chip--active":""}`} onClick={()=>setMode("rcem")}>RCEm</button>
        </div>
      </div>

      {/* tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatTile
          title="Moc teraz"
          value={pvNowW!=null ? `${pvNowW} W` : "—"}
          subtitle="Realtime z inwertera (60 s)"
        />
        <StatTile
          title="Wygenerowano (dzień)"
          value={genDay!=null ? `${genDay.toFixed(1)} kWh` : "—"}
        />
        <StatTile
          title="Przychód (dzień)"
          value={revenueDay!=null ? `${revenueDay.toFixed(2)} PLN` : "—"}
          subtitle={mode==="rce" ? "RCE godzinowe" : "RCEm (średnia mies.)"}
        />
      </div>

      {/* chart */}
      <PowerChart points={powerPoints} title={`Moc [kW] — ${date}`} />

    </div>
  );
}