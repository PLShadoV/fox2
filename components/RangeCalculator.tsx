
"use client";
import React, { useMemo, useState } from "react";

function toIso(d: string) {
  const ddmm = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const ymd  = /^(\d{4})-(\d{2})-(\d{2})$/;
  if (ddmm.test(d)) {
    const [, dd, mm, yyyy] = d.match(ddmm)!;
    return `${yyyy}-${mm}-${dd}`;
  }
  if (ymd.test(d)) return d;
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0,10);
  return "";
}

export default function RangeCalculator() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [mode, setMode] = useState<"rce"|"rcem">("rce");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{kWh:number; revenue:number}>({kWh:0, revenue:0});

  const disabled = useMemo(() => !from || !to, [from, to]);

  async function handleCompute() {
    const A = toIso(from);
    const B = toIso(to);
    if (!A || !B) return;
    setLoading(true);
    setResult({kWh:0, revenue:0});
    try {
      const res = await fetch(`/api/range/compute?from=${encodeURIComponent(A)}&to=${encodeURIComponent(B)}&mode=${mode}`, { cache: "no-store" });
      const j = await res.json();
      if (j?.ok) {
        setResult({ kWh: j.totals.kWh || 0, revenue: j.totals.revenuePLN || 0 });
      } else {
        console.error("range/compute error", j);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pv-card pv-card--pad">
      <div className="pv-row pv-row--gap">
        <div className="pv-col">
          <label className="pv-label">Od</label>
          <input className="pv-input" placeholder="01.07.2025" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div className="pv-col">
          <label className="pv-label">Do</label>
          <input className="pv-input" placeholder="31.07.2025" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div className="pv-col pv-col--mode">
          <label className="pv-label">Tryb</label>
          <div className="pv-chip-group">
            <button className={`pv-chip ${mode==="rce"?"pv-chip--active":""}`} onClick={()=>setMode("rce")}>RCE</button>
            <button className={`pv-chip ${mode==="rcem"?"pv-chip--active":""}`} onClick={()=>setMode("rcem")}>RCEm</button>
          </div>
        </div>
        <div className="pv-col pv-col--action">
          <button className="pv-btn" disabled={disabled||loading} onClick={handleCompute}>
            {loading ? "Liczenie..." : "Oblicz"}
          </button>
        </div>
      </div>

      <div className="pv-result">
        <span>Suma GENERATION:</span>&nbsp;
        <strong>{result.kWh.toFixed(2)} kWh</strong>,&nbsp;
        <span>Suma przychodu:</span>&nbsp;
        <strong>{result.revenue.toFixed(2)} PLN</strong>
      </div>
    </div>
  );
}
