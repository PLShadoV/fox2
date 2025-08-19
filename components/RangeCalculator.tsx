'use client';
import { useState } from 'react';

type Mode = 'rce' | 'rcem';

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function RangeCalculator() {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [mode, setMode] = useState<Mode>('rce');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sum, setSum] = useState<{kwh:number, revenue_pln:number} | null>(null);

  async function onCompute() {
    setLoading(true);
    setError(null);
    setSum(null);
    try {
      if (!from || !to) throw new Error('Podaj zakres dat');
      const url = `/api/range/compute?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Błąd liczenia');
      setSum(j.sum);
    } catch (e:any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pv-card p-4 mt-6">
      <div className="text-xl font-semibold mb-3">Kalkulator zakresu (sumy GENERATION i przychodu)</div>
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex flex-col">
          <label className="text-sm mb-1">Od</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="pv-input"/>
        </div>
        <div className="flex flex-col">
          <label className="text-sm mb-1">Do</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="pv-input"/>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Tryb</span>
          <button onClick={()=>setMode('rce')}  className={`pv-chip ${mode==='rce' ? 'pv-chip--active' : ''}`}>RCE</button>
          <button onClick={()=>setMode('rcem')} className={`pv-chip ${mode==='rcem' ? 'pv-chip--active' : ''}`}>RCEm</button>
        </div>
        <button onClick={onCompute} disabled={loading} className="pv-btn self-start">{loading ? 'Liczenie…' : 'Oblicz'}</button>
      </div>
      <div className="mt-4">
        {error && <div className="text-red-400">{error}</div>}
        {sum && (
          <div className="text-lg">
            Suma <span className="font-semibold">GENERATION:</span> {sum.kwh.toFixed(2)} kWh,
            <span className="font-semibold"> przychodu:</span> {sum.revenue_pln.toFixed(2)} PLN
          </div>
        )}
      </div>
    </div>
  );
}