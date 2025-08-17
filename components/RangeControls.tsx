"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export default function RangeControls(){
  const router = useRouter();
  const sp = useSearchParams();
  const [date, setDate] = useState<string>(()=> sp.get("date") || fmt(new Date()));

  useEffect(()=>{
    const qd = sp.get("date"); if (qd) setDate(qd);
  }, [sp]);

  const go = (view: string, dateISO?: string) => {
    const d = dateISO || date || fmt(new Date());
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set("view", view);
    params.set("date", d);
    router.push(`/?${params.toString()}`);
  };

  const today = () => go("day", fmt(new Date()));
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); go("day", fmt(d)); };
  const thisWeek = () => go("week");
  const thisMonth = () => go("month");
  const thisYear = () => go("year");

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex gap-2 flex-wrap">
        <button className="card px-3 py-2 text-sm hover:shadow" onClick={today}>Dzisiaj</button>
        <button className="card px-3 py-2 text-sm hover:shadow" onClick={yesterday}>Wczoraj</button>
        <button className="card px-3 py-2 text-sm hover:shadow" onClick={thisWeek}>Ten tydzień</button>
        <button className="card px-3 py-2 text-sm hover:shadow" onClick={thisMonth}>Ten miesiąc</button>
        <button className="card px-3 py-2 text-sm hover:shadow" onClick={thisYear}>Ten rok</button>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm">Data:</label>
        <input
          type="date"
          value={date}
          onChange={(e)=>setDate(e.target.value)}
          className="card px-3 py-2 text-sm"
        />
        <button className="card px-3 py-2 text-sm hover:shadow" onClick={()=>go("day")}>Pokaż</button>
      </div>
    </div>
  );
}
