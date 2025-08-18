"use client";
import React, { useEffect, useMemo, useState } from "react";
import StatTile from "./StatTile";

type RevenueRow = { hour:number; kwh:number; price_used_pln_mwh:number; revenue_pln:number };
type RevenueDay = { unit:string; rows: RevenueRow[], totals:{kwh:number; revenue_pln:number} };

async function getJSON<T>(url:string): Promise<T>{
  const r = await fetch(url,{ cache:"no-store" });
  if(!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}

function fmtDate(d:Date){
  return d.toISOString().slice(0,10);
}

export default function DashboardClient(){
  const [date,setDate] = useState<string>(fmtDate(new Date()));
  const [pvNowW,setPvNowW] = useState<number|null>(null);
  const [genTotal,setGenTotal] = useState<number|null>(null);
  const [rev,setRev] = useState<number|null>(null);
  const [mode,setMode] = useState<"rce"|"rcem">("rce");

  // realtime every 60s, regardless of selected date
  useEffect(()=>{
    let stop=false;
    const tick = async()=>{
      try{
        const r = await getJSON<{ok:boolean; pvNowW:number|null; matched:string|null}>("/api/foxess/realtime");
        if(!stop) setPvNowW(r.pvNowW);
      }catch{ if(!stop) setPvNowW(null); }
    };
    tick();
    const id = setInterval(tick, 60000);
    return ()=>{ stop=true; clearInterval(id); };
  },[]);

  // day generation
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const d = await getJSON<{ok:boolean; today:{generation:{total:number}}, date:string;}>(`/api/foxess/day?date=${date}`);
        if(active) setGenTotal(d.today?.generation?.total ?? null);
      }catch{ if(active) setGenTotal(null); }
    })();
    return ()=>{active=false};
  },[date]);

  // revenue
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        if(mode==="rce"){
          const d:RevenueDay = await getJSON(`/api/revenue/day?date=${date}`);
          if(active) setRev(d.totals.revenue_pln);
        }else{
          const d = await getJSON<{ok:boolean; revenue_pln:number}>(`/api/rcem/revenue?from=${date}&to=${date}`);
          if(active) setRev(d.revenue_pln);
        }
      }catch{ if(active) setRev(null); }
    })();
    return ()=>{active=false};
  },[date,mode]);

  // date control
  const onPrev = ()=> setDate(prev=>{
    const d = new Date(prev+"T00:00:00");
    d.setDate(d.getDate()-1);
    return fmtDate(d);
  });
  const onToday = ()=> setDate(fmtDate(new Date()));

  return (
    <div className="glass-wrap">
      <div className="glass-row">
        <StatTile title="Moc teraz" value={pvNowW!=null? `${pvNowW} W` : "—"} subtitle="Realtime z inwertera (60 s)"/>
        <StatTile title="Wygenerowano (dzień)" value={genTotal!=null? `${genTotal.toFixed(1)} kWh` : "—"} />
        <StatTile title="Przychód (dzień)" value={rev!=null? `${rev.toFixed(2)} PLN` : "—"} subtitle={mode==="rce"?"RCE godzinowe":"RCEm — średnia mies."}/>
      </div>

      <div className="glass-toolbar">
        <button className="chip" onClick={onToday}>Dziś</button>
        <button className="chip" onClick={onPrev}>Wczoraj</button>
        <input className="chip" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <div className="chipgrp">
          <button className={`chip ${mode==="rce"?"active":""}`} onClick={()=>setMode("rce")}>RCE</button>
          <button className={`chip ${mode==="rcem"?"active":""}`} onClick={()=>setMode("rcem")}>RCEm</button>
        </div>
      </div>
    </div>
  );
}
