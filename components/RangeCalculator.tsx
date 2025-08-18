'use client';
import React, { useState } from 'react';

export default function RangeCalculator(){
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'rcem'|'rce'>('rcem');
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState<{kwh:number, revenue:number}|null>(null);
  async function compute(){
    if(!from || !to) return;
    setLoading(true);
    try{
      let url = `/api/rcem/revenue?from=${from}&to=${to}&mode=${mode}`;
      const res = await fetch(url);
      const j = await res.json();
      if(j && j.ok){
        setOut({ kwh:j.kwh, revenue:j.revenue_pln });
      } else {
        setOut({ kwh:0, revenue:0 });
      }
    }catch(e){
      setOut({ kwh:0, revenue:0 });
    }finally{
      setLoading(false);
    }
  }
  return (
    <div className="pv-panel">
      <h4>Kalkulator zakresu (suma GENERATION i przychodu)</h4>
      <div className="pv-toolbar" style={{marginBottom:12}}>
        <div>Od</div>
        <input className="pv-input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
        <div>Do</div>
        <input className="pv-input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
        <div>Tryb</div>
        <button className={"pv-chip "+(mode==='rce'?'pv-chip--active':'')} onClick={()=>setMode('rce')}>RCE</button>
        <button className={"pv-chip "+(mode==='rcem'?'pv-chip--active':'')} onClick={()=>setMode('rcem')}>RCEm</button>
        <button className="pv-btn" disabled={loading || !from || !to} onClick={compute}>{loading?'Liczenie…':'Oblicz'}</button>
      </div>
      <div>
        {out ? <div>Suma GENERATION: <b>{out.kwh.toFixed(2)} kWh</b>, Suma przychodu: <b>{out.revenue.toFixed(2)} PLN</b></div> : <div>Wybierz zakres i tryb obliczeń.</div>}
      </div>
    </div>
  );
}