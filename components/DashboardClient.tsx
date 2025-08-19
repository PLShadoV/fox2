'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import StatTile from './StatTile';
import PowerChart, { HourPoint } from './PowerChart';
import HourlyTable from './HourlyTable';
import RangeCalculator from './RangeCalculator';
import ThemeToggle from './ThemeToggle';
import { fmtHour } from '@/lib/date';
import { rcemFor, rcemTable } from '@/lib/rcem';

type RCEHour = { timeISO: string; rce_pln_mwh: number };

function normalizeHourly(gen: any): number[] {
  // Accept a variety of shapes and diff if cumulative
  const arr = gen?.series || gen?.values || gen || [];
  if (!Array.isArray(arr)) return new Array(24).fill(0);
  const nums = arr.map((x:any)=> Number(x) || 0);
  // Heuristic: if final value > sum of diffs, assume it's cumulative -> diff
  const diffs:number[] = [];
  let prev = 0;
  for(let i=0;i<nums.length;i++){ diffs.push(Math.max(0, +(nums[i]-prev).toFixed(3))); prev = nums[i]; }
  const sumNums = nums.reduce((a,b)=>a+b,0);
  const sumDiffs = diffs.reduce((a,b)=>a+b,0);
  return (sumNums>sumDiffs*1.8) ? diffs.slice(0,24) : nums.slice(0,24);
}

export default function DashboardClient(){
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [mode, setMode] = useState<'rce'|'rcem'>('rce');
  const [pvNow, setPvNow] = useState<number|null>(null);
  const [genSeries, setGenSeries] = useState<number[]>(new Array(24).fill(0));
  const [rce, setRce] = useState<RCEHour[]|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const lastRealtimeFetch = useRef<number>(0);

  // fetch realtime every 60s, but always show even when browsing other date
  useEffect(()=>{
    let stop = false;
    async function tick(){
      if (stop) return;
      const now = Date.now();
      if (now - lastRealtimeFetch.current < 60000) return;
      lastRealtimeFetch.current = now;
      try{
        const r = await fetch('/api/foxess/realtime');
        if(r.ok){
          const j = await r.json();
          const w = j?.pvNowW ?? j?.pvNow ?? j?.watt ?? null;
          if(typeof w === 'number') setPvNow(w);
        }
      }catch{}
    }
    tick();
    const id = setInterval(tick, 6000);
    return ()=>{ stop=true; clearInterval(id); };
  }, []);

  async function loadDay(d:string){
    setErr(null); setLoading(true);
    try{
      // FoxESS day (expects existing endpoint in your project)
      const fr = await fetch(`/api/foxess/day?date=${encodeURIComponent(d)}`);
      const fj = await fr.json();
      if(!fr.ok || fj.ok===false) throw new Error(fj.error || 'FoxESS day error');
      const hourly = normalizeHourly(fj?.today?.generation || fj?.generation || fj?.result?.[0]);
      while(hourly.length<24) hourly.push(0);
      setGenSeries(hourly.slice(0,24));

      // RCE hourly if available
      const rr = await fetch(`/api/rce/day?date=${encodeURIComponent(d)}`);
      if(rr.ok){
        const rj = await rr.json();
        const rows = rj?.rows || rj?.data || rj;
        const mapped:RCEHour[] = Array.isArray(rows) ? rows.map((x:any,i:number)=> ({
          timeISO: x.timeISO || new Date(`${d}T${String(i).padStart(2,'0')}:00:00Z`).toISOString(),
          rce_pln_mwh: Number(x.rce_pln_mwh ?? x.price_pln_mwh ?? 0)
        })) : null;
        setRce(mapped);
      }else setRce(null);
    }catch(e:any){
      setErr(e.message);
    }finally{ setLoading(false); }
  }

  useEffect(()=>{ loadDay(date); }, [date]);

  const chartData:HourPoint[] = useMemo(()=> genSeries.map((k,i)=>({t:fmtHour(i), kwh:k})), [genSeries]);

  const rows = useMemo(()=> {
    const price = mode==='rcem' ? (rcemFor(date) || 0) : 0;
    return genSeries.map((kwh, i)=>{
      const p = mode==='rce' ? (rce?.[i]?.rce_pln_mwh ?? null) : price;
      const used = (p==null ? null : Math.max(0, p));
      const revenue = used==null ? null : (kwh * used / 1000);
      return { hour: fmtHour(i), kwh, price: used, revenue };
    });
  }, [genSeries, rce, mode, date]);

  const totalKWh = genSeries.reduce((a,b)=>a+b,0);
  const totalRevenue = rows.reduce((a,b)=> a + (b.revenue||0), 0);

  return (
    <>
      <div className="hstack" style={{marginBottom:12, alignItems:'center'}}>
        <div style={{fontSize:28, fontWeight:800}}>FoxESS × RCE</div>
        <a className="chip link" href="https://www.foxesscloud.com/" target="_blank">FoxESS</a>
        <a className="chip link" href="https://raporty.pse.pl/report/rce-pln" target="_blank">RCE (PSE)</a>
        <div className="spacer" />
        <ThemeToggle />
        <button className="chip" onClick={()=>setDate(new Date().toISOString().slice(0,10))}>Dziś</button>
        <button className="chip" onClick={()=>{
          const d=new Date(date+'T00:00:00'); d.setDate(d.getDate()-1); setDate(d.toISOString().slice(0,10));
        }}>Wczoraj</button>
        <input className="chip" type="date" value={date} onChange={e=>setDate(e.target.value)} />
      </div>

      {/* Stat tiles */}
      <div className="grid-3">
        <StatTile title="Moc teraz" value={pvNow!=null?`${pvNow} W`:'—'} subtitle="Realtime z inwertera (60 s)" />
        <StatTile title="Wygenerowano (dzień)" value={`${totalKWh.toFixed(1)} kWh`} />
        <StatTile title="Przychód (dzień)" value={`${totalRevenue.toFixed(2)} PLN`} subtitle={mode==='rce'?'RCE godzinowe':'RCEm (średnia mies.)'} />
      </div>

      <div className="hstack" style={{marginTop:12, marginBottom:12}}>
        <div style={{color:'var(--muted)'}}>Tryb obliczeń:</div>
        <button className={'chip '+(mode==='rce'?'active':'')} onClick={()=>setMode('rce')}>RCE</button>
        <button className={'chip '+(mode==='rcem'?'active':'')} onClick={()=>setMode('rcem')}>RCEm</button>
        <div className="spacer" />
        {mode==='rce' && !rce && <div className="notice">Brak danych RCE dla tego dnia — przełącz na RCEm.</div>}
      </div>

      <PowerChart data={chartData} title={`Moc [kW] — ${date}`} />

      <div style={{height:12}} />

      <HourlyTable rows={rows} date={date} priceLabel={mode==='rce'?'Cena RCE (PLN/MWh)':'Cena RCEm (PLN/MWh)'} />

      <div style={{height:12}} />

      <RangeCalculator />

      <div style={{height:12}} />

      <div className="glass" style={{padding:16}}>
        <div style={{fontWeight:700, marginBottom:8}}>RCEm — miesięczne ceny (PLN/MWh)</div>
        <table className="table">
          <thead><tr><th>Miesiąc</th><th>Cena (PLN/MWh)</th></tr></thead>
          <tbody>
            {rcemTable().map(row=>(
              <tr key={row.month}>
                <td className="kbd">{row.month}</td>
                <td>{row.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <div className="error" style={{marginTop:12}}>{String(err)}</div>}
    </>
  );
}
