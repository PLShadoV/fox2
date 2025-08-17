"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

function fmt(d: Date){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

export default function Toolbar(){
  const router = useRouter();
  const sp = useSearchParams();
  const date = sp.get("date") || fmt(new Date());
  const range = sp.get("range") || "day";

  const go = (params: Record<string,string>) => {
    const usp = new URLSearchParams(sp.toString());
    Object.entries(params).forEach(([k,v]) => v ? usp.set(k,v) : usp.delete(k));
    router.push(`/?${usp.toString()}`);
  };

  const onDateChange = (e:any)=> {
    const v = String(e.target.value || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) go({ date: v, range: "day" });
  };

  const today = useMemo(()=> new Date(), []);
  const yesterday = useMemo(()=> { const d=new Date(); d.setDate(d.getDate()-1); return d; }, []);

  const setToday = ()=> go({ date: fmt(today), range: "day" });
  const setYesterday = ()=> go({ date: fmt(yesterday), range: "day" });

  const setWeek = ()=> go({ date, range: "week" });
  const setMonth = ()=> go({ date, range: "month" });
  const setYear = ()=> go({ date, range: "year" });

  return (
    <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div className="flex gap-2 flex-wrap">
        <button className="btn" onClick={setToday}>Dziś</button>
        <button className="btn" onClick={setYesterday}>Wczoraj</button>
        <button className="btn" onClick={setWeek}>Ten tydzień</button>
        <button className="btn" onClick={setMonth}>Ten miesiąc</button>
        <button className="btn" onClick={setYear}>Ten rok</button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm opacity-70">Data:</span>
        <input type="date" value={date} onChange={onDateChange} className="input" />
      </div>
    </div>
  );
}
