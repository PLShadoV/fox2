"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

function fmt(d: Date) { return d.toISOString().slice(0,10); }

export default function RangeButtons() {
  const router = useRouter();
  const sp = useSearchParams();
  const setDate = useCallback((d: Date)=>{
    const url = new URL(window.location.href);
    url.searchParams.set("date", fmt(d));
    router.push(url.pathname + "?" + url.searchParams.toString());
  },[router]);

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={()=> setDate(new Date())} className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Dziś</button>
      <button onClick={()=> { const d=new Date(); d.setDate(d.getDate()-1); setDate(d); }} className="px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Wczoraj</button>
      <input
        type="date"
        className="px-3 py-2 rounded-xl border text-sm"
        defaultValue={sp.get("date") || new Date().toISOString().slice(0,10)}
        onChange={(e)=>{
          const url = new URL(window.location.href);
          url.searchParams.set("date", e.target.value);
          router.push(url.pathname + "?" + url.searchParams.toString());
        }}
      />
    </div>
  );
}
