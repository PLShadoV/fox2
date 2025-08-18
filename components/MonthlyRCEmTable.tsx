"use client";

import { useEffect, useState } from "react";

type Item = { label: string; value: number|null };

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
          const rows = (jj?.items || []).map((x:any)=>({label: x.month, value: x.value}));
          setItems(rows);
          setNote("Brak danych z PSE – pokazuję średnie miesięczne z godzinowego RCE (fallback).");
        }
      })
      .catch(()=>{
        setNote("Nie udało się pobrać RCEm.");
      })
      .finally(()=> setLoading(false));
    return ()=> { cancelled = true; };
  }, []);

  return (
    <div className="pv-card p-5">
      <div className="mb-3 pv-title font-medium">RCEm – miesięczne ceny (PLN/MWh)</div>
      <div className="overflow-x-auto">
        <table className="min-w-[420px] w-full text-sm">
          <thead className="opacity-80">
            <tr>
              <th className="text-left py-2 pr-4 font-normal">Miesiąc</th>
              <th className="text-right py-2 font-normal">RCEm (PLN/MWh)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="py-3 opacity-80" colSpan={2}>Wczytywanie…</td></tr>
            ) : items.length ? items.map((it, i)=> (
              <tr key={i} className="border-t" style={{ borderColor: "var(--pv-border)" }}>
                <td className="py-2 pr-4 capitalize">{it.label}</td>
                <td className="py-2 text-right">{it.value != null ? it.value.toFixed(2) : "-"}</td>
              </tr>
            )) : (
              <tr><td className="py-3 opacity-80" colSpan={2}>Brak danych</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {note ? <div className="mt-2 text-xs opacity-70">{note}</div> : null}
    </div>
  );
}
