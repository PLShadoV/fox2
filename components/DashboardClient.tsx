'use client';
import React, { useEffect, useMemo, useState } from 'react';
import StatTile from '@/components/StatTile';
import PowerChart, { Point } from '@/components/PowerChart';
import HourlyTable, { HourRow } from '@/components/HourlyTable';
import RangeCalculator from '@/components/RangeCalculator';

type Mode = 'rce'|'rcem';

function ymd(d: Date){ return d.toISOString().slice(0,10); }

export default function DashboardClient({ initialDate }:{ initialDate: string }){
  const [date, setDate] = useState(initialDate);
  const [mode, setMode] = useState<Mode>('rce');
  const [pvNowW, setPvNowW] = useState<number|null>(null);
  const [genSeries, setGenSeries] = useState<number[]>([]);
  const [genTotal, setGenTotal] = useState<number>(0);
  const [rows, setRows] = useState<HourRow[]>([]);
  const [revenueDay, setRevenueDay] = useState<number|null>(null);
  const [chart, setChart] = useState<Point[]>([]);

  // Realtime (60 s)
  useEffect(()=>{
    let stop = false;
    async function load(){
      try{
        const r = await fetch('/api/foxess/realtime', { cache:'no-store' });
        const j = await r.json();
        if(!stop) setPvNowW(j?.pvNowW ?? null);
      }catch{}
    }
    load();
    const id = setInterval(load, 60000);
    return ()=>{ stop = true; clearInterval(id); }
  }, []);

  // Day foxess
  useEffect(()=>{
    let stop=false;
    async function loadDay(){
      try{
        const r = await fetch(`/api/foxess/day?date=${date}`, { cache:'no-store' });
        const j = await r.json();
        if(!j || !j.ok){ setGenSeries([]); setGenTotal(0); return; }
        const g = j.today?.generation || j.generation || j.today?.gen || null;
        let series:number[]=[]; let total=0;
        if(g){
          if(Array.isArray(g.series)) series = g.series;
          else if(Array.isArray(g.values)) series = g.values;
          total = typeof g.total==='number' ? g.total : series.reduce((a:number,v:number)=>a+(Number(v)||0),0);
        }
        if(!stop){
          setGenSeries(series);
          setGenTotal(total);
        }
      }catch{
        setGenSeries([]); setGenTotal(0);
      }
    }
    loadDay();
    // prices for RCE hours
    async function loadRCE(){
      try{
        const r = await fetch(`/api/rce/day?date=${date}`, { cache:'no-store' });
        const j = await r.json();
        if(j && j.ok && Array.isArray(j.rows)){
          const rows: HourRow[] = (j.rows as any[]).map((row:any, i:number)=>({
            hour: row.hour ?? i,
            kwh: Number(genSeries[i]||0),
            price_pln_mwh: Number(row.rce_pln_mwh ?? row.price_pln_mwh ?? 0),
            revenue_pln: Math.max(0, Number(row.rce_pln_mwh ?? row.price_pln_mwh ?? 0)) * Number(genSeries[i]||0) / 1000
          }));
          setRows(rows);
        } else {
          // fallback to RCEm constant price
          const r2 = await fetch('/api/rcem/month');
          const m = await r2.json();
          const mk = date.slice(0,7);
          const price = (m?.months?.[mk] || 0);
          const rows: HourRow[] = [...Array(24)].map((_,i)=>({
            hour:i,
            kwh: Number(genSeries[i]||0),
            price_pln_mwh: price,
            revenue_pln: price * Number(genSeries[i]||0) / 1000
          }));
          setRows(rows);
        }
      }catch{
        setRows([]);
      }
    }
    loadRCE();
    // Chart
    async function loadChart(){
      try{
        const r = await fetch(`/api/foxess/power?date=${date}`, { cache:'no-store' });
        const j = await r.json();
        if(j && j.ok && Array.isArray(j.points)){
          setChart((j.points as any[]).map((p:any)=>({ t: (p.time||p.t), kw: Number(p.kw ?? p.value ?? 0) })));
          return;
        }
      }catch {}
      // fallback from hourly kWh -> pseudo kW sample at xx:30
      const points: Point[] = [...Array(24)].map((_,i)=>({ t: String(i).padStart(2,'0')+':30', kw: Number(genSeries[i]||0) }));
      setChart(points);
    }
    loadChart();

    return ()=>{ stop = true; };
  }, [date, /* recalc when genSeries length changes */ genSeries.length]);

  // Compute day revenue
  useEffect(()=>{
    async function compute(){
      if(mode==='rcem'){
        const r = await fetch('/api/rcem/month');
        const m = await r.json();
        const mk = date.slice(0,7);
        const price = (m?.months?.[mk] || 0);
        setRevenueDay(Number((genTotal * price / 1000).toFixed(2)));
      } else {
        try{
          const r = await fetch(`/api/rce/day?date=${date}`, { cache:'no-store' });
          const j = await r.json();
          if(j && j.ok && Array.isArray(j.rows)){
            let sum = 0;
            for(let i=0;i<24;i++){
              const kwh = Number(genSeries[i]||0);
              const price = Number(j.rows[i]?.rce_pln_mwh ?? j.rows[i]?.price_pln_mwh ?? 0);
              sum += Math.max(0, price) * kwh / 1000;
            }
            setRevenueDay(Number(sum.toFixed(2)));
          } else {
            setRevenueDay(null);
          }
        }catch{ setRevenueDay(null); }
      }
    }
    compute();
  }, [mode, date, genSeries, genTotal]);

  const toolbar = (
    <div className="pv-toolbar">
      <a className="pv-chip" href="https://www.foxesscloud.com" target="_blank">FoxESS</a>
      <a className="pv-chip" href="https://raporty.pse.pl/report/rce-pln" target="_blank">RCE (PSE)</a>
      <button className="pv-chip" onClick={()=>{
        // simple theme toggle: swap bg var
        const isLight = document.body.dataset.theme === 'light';
        document.body.dataset.theme = isLight ? 'dark' : 'light';
      }}>Jasny</button>
      <button className="pv-chip pv-chip--active" onClick={()=>setDate(ymd(new Date()))}>Dziś</button>
      <button className="pv-chip" onClick={()=>setDate(ymd(new Date(Date.now()-86400*1000)))}>Wczoraj</button>
      <input className="pv-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
    </div>
  );

  return (
    <div className="pv-shell">
      {toolbar}
      <div className="pv-tiles">
        <StatTile title="Moc teraz" value={pvNowW!==null ? `${pvNowW} W` : '—'} subtitle="Realtime z inwertera (60 s)" />
        <StatTile title="Wygenerowano (dzień)" value={`${genTotal.toFixed(1)} kWh`} />
        <StatTile title="Przychód (dzień)" value={revenueDay!==null ? `${revenueDay.toFixed(2)} PLN` : '—'} subtitle={mode==='rce' ? 'RCE godzinowe' : 'RCEm (średnia mies.)'} />
      </div>

      <div className="pv-toolbar" style={{justifyContent:'flex-end'}}>
        <div>Tryb obliczeń:</div>
        <button className={"pv-chip "+(mode==='rce'?'pv-chip--active':'')} onClick={()=>setMode('rce')}>RCE</button>
        <button className={"pv-chip "+(mode==='rcem'?'pv-chip--active':'')} onClick={()=>setMode('rcem')}>RCEm</button>
      </div>

      <PowerChart data={chart} title={`Moc [kW] — ${date}`} />

      <HourlyTable rows={rows} date={date} modeLabel={mode.toUpperCase()} />

      <RangeCalculator />
    </div>
  );
}