"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

function toISO(d: Date){
  return d.toISOString().slice(0,10);
}

export default function RangeButtons(){
  const router = useRouter();
  const sp = useSearchParams();
  const [date, setDate] = useState(sp.get("date") || toISO(new Date()));

  useEffect(()=>{
    const cur = sp.get("date") || toISO(new Date());
    setDate(cur);
  }, [sp]);

  const go = (d: string)=> {
    const url = new URL(window.location.href);
    url.searchParams.set("date", d);
    router.push(url.pathname + "?" + url.searchParams.toString());
  };

  const today = ()=> go(toISO(new Date()));
  const yesterday = ()=> {
    const dt = new Date();
    dt.setDate(dt.getDate()-1);
    go(toISO(dt));
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={today} className="px-4 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm hover:bg-white/70 transition glass-focus">
        Dziś
      </button>
      <button onClick={yesterday} className="px-4 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm hover:bg-white/70 transition glass-focus">
        Wczoraj
      </button>
      <input
        type="date"
        value={date}
        onChange={(e)=> { setDate(e.target.value); go(e.target.value); }}
        className="px-3 py-2 rounded-2xl bg-white/60 border border-white/30 backdrop-blur-xl shadow-sm glass-focus"
      />
    </div>
  );
}
