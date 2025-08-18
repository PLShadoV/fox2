'use client';

import { useEffect, useMemo, useState } from 'react';

type Mode = 'rce' | 'rcem';

function toIsoDate(d: Date): string {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateFlexible(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const dot = /^\d{2}\.\d{2}\.\d{4}$/;
  if (iso.test(t)) {
    // Treat as local date (no time); normalize to local midnight
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (dot.test(t)) {
    const [d, m, y] = t.split('.').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export default function RangeCalculator() {
  // Default: current month
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [fromStr, setFromStr] = useState<string>(toIsoDate(first));
  const [toStr, setToStr] = useState<string>(toIsoDate(last));
  const [mode, setMode] = useState<Mode>('rce');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sum, setSum] = useState<{ kwh: number; revenue: number } | null>(null);

  const from = useMemo(() => parseDateFlexible(fromStr), [fromStr]);
  const to = useMemo(() => parseDateFlexible(toStr), [toStr]);

  const valid = !!from && !!to && from.getTime() <= to.getTime();

  async function compute() {
    if (!valid) return;
    setLoading(true);
    setError(null);
    setSum(null);
    try {
      const url = `/api/range/compute?from=${encodeURIComponent(toIsoDate(from!))}&to=${encodeURIComponent(toIsoDate(to!))}&mode=${mode}`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.ok) {
        throw new Error(j.error || 'Błąd liczenia');
      }
      setSum({ kwh: j.totals.kwh ?? 0, revenue: j.totals.revenue_pln ?? 0 });
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // optional: auto compute on mount
  }, []);

  return (
    <div className="pv-card pv-range">
      <div className="pv-card__title">Kalkulator zakresu (sumy <b>GENERATION</b> i przychodu)</div>
      <div className="pv-range__row">
        <label className="pv-field">
          <span>Od</span>
          <input
            type="date"
            value={toIsoDate(from || first)}
            onChange={(e) => setFromStr(e.target.value)}
            className="pv-input"
          />
        </label>
        <label className="pv-field">
          <span>Do</span>
          <input
            type="date"
            value={toIsoDate(to || last)}
            onChange={(e) => setToStr(e.target.value)}
            className="pv-input"
          />
        </label>
        <div className="pv-field">
          <span>Tryb</span>
          <div className="pv-chip-group">
            <button
              type="button"
              className={`pv-chip ${mode === 'rce' ? 'pv-chip--active' : ''}`}
              onClick={() => setMode('rce')}
            >
              RCE
            </button>
            <button
              type="button"
              className={`pv-chip ${mode === 'rcem' ? 'pv-chip--active' : ''}`}
              onClick={() => setMode('rcem')}
            >
              RCEm
            </button>
          </div>
        </div>
        <div className="pv-field pv-field--right">
          <span>&nbsp;</span>
          <button
            type="button"
            onClick={compute}
            disabled={!valid || loading}
            className="pv-btn pv-btn--primary"
            title={!valid ? 'Ustaw poprawny zakres dat' : 'Oblicz'}
          >
            {loading ? 'Liczenie…' : 'Oblicz'}
          </button>
        </div>
      </div>

      {!valid && (
        <div className="pv-note pv-note--warn">Niepoprawny zakres dat (Od ≤ Do).</div>
      )}
      {error && <div className="pv-note pv-note--error">{error}</div>}
      <div className="pv-range__sum">
        Suma <b>GENERATION</b>: <b>{(sum?.kwh ?? 0).toFixed(2)}</b> kWh,
        &nbsp;Suma przychodu: <b>{(sum?.revenue ?? 0).toFixed(2)}</b> PLN
      </div>
    </div>
  );
}
