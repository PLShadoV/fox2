"use client";
import { useState } from "react";

async function getJSON(url: string){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Fetch ${url} failed: ${r.status}`);
  return r.json();
}

export default function RangeCalculator(){
  const today = new Date().toISOString().slice(0,10);
  const monthStartD = new Date();
  monthStartD.setDate(1);
  const defaultFrom = monthStartD.toISOString().slice(0,10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [mode, setMode] = useState<"rce"|"rcem">("rce");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{kwh:number; pln:number} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async ()=>{
    try{
      setLoading(true); setError(null);
      const j = await getJSON(`/api/range/compute?from=${from}&to=${to}&mode=${mode}`);
      setRes({ kwh: j?.kwh ?? 0, pln: j?.pln ?? 0 });
    }catch(e:any){
      setError(e.message);
    }finally{ setLoading(false); }
  };

  return (
    <div className="p-5 rounded-2xl shadow-lg shadow-sky-100/40 bg-white/60 border border-white/40 backdrop-blur-xl space-y-3">
      <div className="text-sm text-sky-900/70">Kalkulator zakresu (sumy GENERATION i przychodu)</div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-sky-900/70">Od</label>
          <input type="date" value={from} onChange={e=> setFrom(e.target.value)} className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm glass-focus" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-sky-900/70">Do</label>
          <input type="date" value={to} onChange={e=> setTo(e.target.value)} className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm glass-focus" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-sky-900/70">Tryb:</span>
          <button onClick={()=> setMode("rce")} className={"px-3 py-2 rounded-2xl border " + (mode==="rce"?"bg-sky-500 text-white border-sky-500":"bg-white/60 border-white/30")}>RCE</button>
          <button onClick={()=> setMode("rcem")} className={"px-3 py-2 rounded-2xl border " + (mode==="rcem"?"bg-sky-500 text-white border-sky-500":"bg-white/60 border-white/30")}>RCEm</button>
        </div>
        <button onClick={run} disabled={loading} className="ml-auto px-4 py-2 rounded-2xl bg-sky-600 text-white shadow hover:bg-sky-700 disabled:opacity-50">Oblicz</button>
      </div>
      {error ? <div className="text-amber-700 text-sm">{error}</div> : null}
      {res ? <div className="text-sky-900 text-sm">Suma GENERATION: <b>{res.kwh.toFixed(1)} kWh</b>, Suma przychodu: <b>{res.pln.toFixed(2)} PLN</b></div> : null}
    </div>
  );
}
