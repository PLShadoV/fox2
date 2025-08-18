"use client";

import { useEffect, useState } from "react";

type Item = { year:number; monthIndex:number; monthLabel:string; value:number|null; ym?:string };

export default function MonthlyRCEmTable(){
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    let cancelled = false;
    setLoading(true);
    fetch("/api/rcem", { cache: "no-store" })
      .then(r => r.json())
      .then(async j => {
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.items) && j.items.length){
          setItems(j.items);
          setNote("Źródło: PSE (RCEm – miesięczna).");
        } else {
          const r = await fetch("/api/rce/month-avg", { cache: "no-store" });
          const jj = await r.json();
          const rows = (jj?.items || []).map((x:any)=>({year: x.year, monthIndex: x.monthIndex, monthLabel: x.monthLabel, value: x.value, ym: x.ym}));
          // sort DESC by ym
          rows.sort((a:any,b:any)=> (b.year - a.year) || (b.monthIndex - a.monthIndex));
          setItems(rows);
          setNote("Brak danych z PSE – pokazuję średnie miesięczne z godzinowego RCE (fallback).");
        }
      })
      .catch(()=> setNote("Nie udało się pobrać RCEm."))
      .finally(()=> setLoading(false));
    return ()=> { cancelled = true; };
  }, []);

  return (
    <div className="pv-card p-5">
      <div className="mb-3 pv-title font-medium">RCEm – miesięczne ceny (PLN/MWh)</div>
      <div className="overflow-x-auto">
        <table className="min-w-[520px] w-full text-sm">
          <thead className="opacity-80">
            <tr>
              <th className="text-left py-2 pr-4 font-normal">Rok</th>
              <th className="text-left py-2 pr-4 font-normal">Miesiąc</th>
              <th className="text-right py-2 font-normal">RCEm (PLN/MWh)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="py-3 opacity-80" colSpan={3}>Wczytywanie…</td></tr>
            ) : items.length ? items.map((it, i)=> (
              <tr key={i} className="border-t" style={{ borderColor: "var(--pv-border)" }}>
                <td className="py-2 pr-4">{it.year}</td>
                <td className="py-2 pr-4 capitalize">{it.monthLabel}</td>
                <td className="py-2 text-right">{it.value != null ? it.value.toFixed(2) : "-"}</td>
              </tr>
            )) : (
              <tr><td className="py-3 opacity-80" colSpan={3}>Brak danych</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {note ? <div className="mt-2 text-xs opacity-70">{note}</div> : null}
    </div>
  );
}
