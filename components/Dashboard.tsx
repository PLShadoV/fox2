"use client";
import { useEffect, useMemo, useState } from "react";
import Kpi from "@/components/Kpi";
import BarChartCard from "@/components/BarChartCard";

type HourRow = { x: string; hour: number; kwh: number; priceMWh: number; priceShown: number; revenuePLN: number };

function addDays(s: string, n:number){
  const d = new Date(s+"T00:00:00");
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}

function startOfMonth(s: string){ const d=new Date(s+"T00:00:00"); d.setDate(1); return d.toISOString().slice(0,10); }
function startOfYear(s: string){ const d=new Date(s+"T00:00:00"); d.setMonth(0,1); return d.toISOString().slice(0,10); }
function startOfWeekISO(s: string){ const d=new Date(s+"T00:00:00"); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); return d.toISOString().slice(0,10); }

export default function Dashboard({ date, range = "day" }: { date: string; range?: string }){
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genSeries, setGenSeries] = useState<number[]>(new Array(24).fill(0));
  const [expSeries, setExpSeries] = useState<number[]>(new Array(24).fill(0));
  const [rows, setRows] = useState<any[]>(new Array(24).fill(null).map((_,h)=>({ rce_pln_mwh: 0 })) );
  const [pvNowW, setPvNowW] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [sumRes, rceRes, rtRes] = await Promise.all([
          fetch(`/api/foxess/summary/day?date=${date}`),
          fetch(`/api/rce?date=${date}`),
          fetch(`/api/foxess/debug/realtime`)
        ]);
        const sum = await sumRes.json();
        const rce = await rceRes.json();
        const rt  = await rtRes.json();

        if (!cancelled) {
          const gen = sum?.today?.generation?.series;
          const exp = sum?.today?.export?.series;
          setGenSeries(Array.isArray(gen) ? gen : new Array(24).fill(0));
          setExpSeries(Array.isArray(exp) ? exp : new Array(24).fill(0));

          const rceRows = Array.isArray(rce?.rows) ? rce.rows : (Array.isArray(rce) ? rce : []);
          setRows(new Array(24).fill(0).map((_,h)=> rceRows[h] ?? { rce_pln_mwh: 0 }));
          setPvNowW(typeof rt?.pvNowW === "number" ? rt.pvNowW : null);
        }
      } catch (e:any) {
        if (!cancelled) setError(e?.message || "Błąd pobierania danych");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [date]);

  const hourly: HourRow[] = useMemo(() => {
    return new Array(24).fill(0).map((_,h)=>{
      const kwh = +(expSeries[h] || 0); // do przychodu liczymy eksport
      const price = Number(rows[h]?.rce_pln_mwh || 0);
      const priceForCalc = Math.max(0, price);
      const revenuePLN = +(kwh * (priceForCalc / 1000)).toFixed(2);
      return { x: String(h).padStart(2, "0")+":00", hour: h, kwh, priceMWh: price, priceShown: price, revenuePLN };
    });
  }, [expSeries, rows]);

  const genTotal = useMemo(()=> genSeries.reduce((a,b)=> a + (b||0), 0), [genSeries]);
  const totalRevenue = useMemo(()=> hourly.reduce((a,b)=> a + b.revenuePLN, 0), [hourly]);

  // Simple range view (generation only)
  const [rangeData, setRangeData] = useState<{ x: string; kwh: number }[] | null>(null);
  useEffect(()=>{
    let cancelled = false;
    (async ()=>{
      if (range === "day") { setRangeData(null); return; }
      const mk = (a:string,b:string)=> ({start:a,end:b});
      let start = date, end = date;
      if (range === "week"){ start = startOfWeekISO(date); end = addDays(start, 6); }
      if (range === "month"){ start = startOfMonth(date); const last = new Date(start+"T00:00:00"); last.setMonth(last.getMonth()+1); last.setDate(0); end = last.toISOString().slice(0,10); }
      if (range === "year"){ start = startOfYear(date); const last = new Date(start+"T00:00:00"); last.setFullYear(last.getFullYear(),11,31); end = last.toISOString().slice(0,10); }
      try {
        const days:string[] = [];
        for (let d=start; d<=end; d=addDays(d,1)) days.push(d);
        const results = await Promise.all(days.map(async day => {
          const r = await fetch(`/api/foxess/summary/day?date=${day}`).then(r=>r.json());
          const kwh = Number(r?.today?.generation?.total || 0);
          return { x: day, kwh };
        }));
        if (!cancelled) setRangeData(results);
      } catch(e:any){
        if (!cancelled) setRangeData(null);
      }
    })();
    return ()=>{ cancelled = true; };
  }, [range, date]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Moc teraz" value={pvNowW!=null ? (pvNowW/1000).toFixed(2) : "-"} unit="kW" />
        <Kpi title="Wygenerowano (ten dzień)" value={genTotal.toFixed(2)} unit="kWh" />
        <Kpi title="Dzisiejszy zarobek" value={totalRevenue.toFixed(2)} unit="PLN" />
      </div>

      {error ? (
        <div className="card p-4 text-red-600">Błąd: {error}</div>
      ) : null}

      {range === "day" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BarChartCard title={`Przychód na godzinę — ${date}`} data={hourly} xKey="x" yKey="revenuePLN" />
            <BarChartCard title={`Generacja (kWh) na godzinę — ${date}`} data={new Array(24).fill(0).map((_,h)=>({ x: String(h).padStart(2,"0")+":00", kwh: genSeries[h]||0 }))} xKey="x" yKey="kwh" />
          </div>

          <div className="card p-4">
            <div className="font-semibold mb-3">Tabela — eksport kWh, ceny RCE, przychód</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Godzina</th>
                    <th>Eksport [kWh]</th>
                    <th>Cena RCE [PLN/MWh]</th>
                    <th>Do obliczeń [PLN/MWh]</th>
                    <th>Przychód [PLN]</th>
                  </tr>
                </thead>
                <tbody>
                  {hourly.map((r, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td>{r.x}</td>
                      <td>{r.kwh.toFixed(3)}</td>
                      <td>{r.priceShown.toFixed(2)}</td>
                      <td>{Math.max(0, r.priceMWh).toFixed(2)}</td>
                      <td>{r.revenuePLN.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td>Suma</td>
                    <td>{hourly.reduce((a,b)=>a+b.kwh,0).toFixed(3)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>{totalRevenue.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        rangeData && (
          <div className="grid grid-cols-1">
            <BarChartCard title={`Generacja (kWh) — ${range}`} data={rangeData} xKey="x" yKey="kwh" />
          </div>
        )
      )}

      {loading ? <div className="text-sm text-slate-500">Ładowanie…</div> : null}
      <div className="text-xs text-slate-500">
        Uwaga: ceny RCE ujemne są pokazywane w tabeli, ale do obliczeń przyjmujemy 0.
      </div>
    </div>
  );
}
