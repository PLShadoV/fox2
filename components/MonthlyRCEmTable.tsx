"use client";
import { useEffect, useState } from "react";

type Row = { month: string; rcem_pln_mwh: number };
type Resp = { ok:boolean; rows: Row[]; note?: string; error?: string };

export default function MonthlyRCEmTable(){
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string|null>(null);
  const [note, setNote] = useState<string|undefined>(undefined);

  useEffect(()=>{
    fetch("/api/rcem", { cache: "no-store" })
      .then(r => r.json())
      .then((j:Resp) => {
        setRows(Array.isArray(j?.rows) ? j.rows : []);
        setNote(j?.note);
      })
      .catch(e => setErr(String(e)));
  }, []);

  return (
    <div className="p-5 rounded-2xl shadow-lg shadow-sky-100/40 bg-white/60 border border-white/40 backdrop-blur-xl">
      <div className="text-sm text-sky-900/70 mb-3">RCEm – miesięczne ceny (PSE / średnie z RCE)</div>
      {err ? <div className="text-amber-700 text-sm">{err}</div> : null}
      <div className="overflow-x-auto">
        <table className="min-w-[400px] text-sm">
          <thead>
            <tr className="text-left text-sky-900/70">
              <th className="py-1 pr-4">Miesiąc</th>
              <th className="py-1">RCEm (PLN/MWh)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-sky-100/60"><td className="py-2" colSpan={2}>Brak danych (spróbuj później).</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t border-sky-100/60">
                <td className="py-1 pr-4">{r.month}</td>
                <td className="py-1">{Number(r.rcem_pln_mwh).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <div className="text-[11px] text-sky-900/60 mt-2">{note}</div> : null}
    </div>
  );
}
