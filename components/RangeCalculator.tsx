'use client';
import { useState } from 'react';

export default function RangeCalculator(){
  const today = new Date().toISOString().slice(0,10);
  const [from, setFrom] = useState(today.slice(0,8)+'01');
  const [to, setTo] = useState(today);
  const [mode, setMode] = useState<'rce'|'rcem'>('rce');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{kwh:number,revenue:number}|null>(null);
  const [err, setErr] = useState<string|null>(null);

  async function compute(){
    setLoading(true); setErr(null);
    try{
      const q = new URLSearchParams({from, to, mode}).toString();
      const r = await fetch(`/api/range/compute?${q}`);
      const j = await r.json();
      if(!r.ok || j.ok===false) throw new Error(j.error || 'Błąd');
      setRes({kwh:j.sumKWh, revenue:j.sumRevenue});
    }catch(e:any){ setErr(e.message); } finally{ setLoading(false); }
  }

  return (
    <div className="glass" style={{padding:16}}>
      <div style={{fontWeight:700, marginBottom:10}}>Kalkulator zakresu (suma GENERATION i przychodu)</div>
      <div className="hstack" style={{gap:12}}>
        <div>Od</div>
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="chip" />
        <div>Do</div>
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="chip" />
        <div>Tryb</div>
        <div className="hstack">
          <button className={"chip "+(mode==='rce'?'active':'')} onClick={()=>setMode('rce')}>RCE</button>
          <button className={"chip "+(mode==='rcem'?'active':'')} onClick={()=>setMode('rcem')}>RCEm</button>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={compute} disabled={loading}>{loading?'Liczenie…':'Oblicz'}</button>
      </div>
      {err && <div className="error" style={{marginTop:12}}>{err}</div>}
      {res && (
        <div style={{marginTop:12}}>
          Suma <b>GENERATION</b>: <b>{res.kwh.toFixed(2)} kWh</b>, Suma przychodu: <b>{res.revenue.toFixed(2)} PLN</b>
        </div>
      )}
    </div>
  );
}
