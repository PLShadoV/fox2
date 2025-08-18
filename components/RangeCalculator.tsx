
"use client";

import React, { useMemo, useState } from "react";

type Mode = "rce" | "rcem";

function parseDateLoose(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  // dd.mm.yyyy
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  let y=0,m=0,d=0;
  if (dot.test(t)) {
    const mth = t.match(dot)!;
    d = +mth[1]; m = +mth[2]; y = +mth[3];
  } else if (iso.test(t)) {
    const mth = t.match(iso)!;
    y = +mth[1]; m = +mth[2]; d = +mth[3];
  } else return null;
  const dt = new Date(Date.UTC(y, m-1, d));
  if (isNaN(+dt)) return null;
  return dt;
}
function toISODate(d: Date): string {
  return d.toISOString().slice(0,10);
}

export default function RangeCalculator({ className = "" }: { className?: string }) {
  // default to current month
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const startDefault = `01.${mm}.${yyyy}`;
  const endDefault = `${String(new Date(Date.UTC(yyyy, now.getUTCMonth()+1, 0)).getUTCDate()).padStart(2,"0")}.${mm}.${yyyy}`;

  const [from, setFrom] = useState<string>(startDefault);
  const [to, setTo] = useState<string>(endDefault);
  const [mode, setMode] = useState<Mode>("rce");
  const [loading, setLoading] = useState(false);
  const [sumKWh, setSumKWh] = useState<number | null>(null);
  const [sumPLN, setSumPLN] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(() => {
    const f = parseDateLoose(from);
    const t = parseDateLoose(to);
    return !!f && !!t && (f.getTime() <= t.getTime());
  }, [from, to]);

  async function handleCompute() {
    if (!valid || loading) return;
    try {
      setLoading(true);
      setError(null);
      const fISO = toISODate(parseDateLoose(from)!);
      const tISO = toISODate(parseDateLoose(to)!);
      const url = `/api/range/compute?from=${fISO}&to=${tISO}&mode=${mode}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || data.ok === false) {
        throw new Error(data?.error || "Błąd przetwarzania zakresu");
      }
      setSumKWh(Number(data.totals?.kwh ?? 0));
      setSumPLN(Number(data.totals?.revenue_pln ?? 0));
    } catch (e:any) {
      setError(e.message || String(e));
      setSumKWh(null);
      setSumPLN(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`pv-card pv-range ${className}`}>
      <div className="pv-card-title">Kalkulator zakresu (sumy GENERATION i przychodu)</div>

      <div className="pv-range-grid">
        <label className="pv-input">
          <span>Od</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="DD.MM.RRRR lub YYYY-MM-DD"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <label className="pv-input">
          <span>Do</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="DD.MM.RRRR lub YYYY-MM-DD"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <div className="pv-mode">
          <span>Tryb</span>
          <div className="pv-chip-group">
            <button
              type="button"
              className={`pv-chip ${mode === "rce" ? "pv-chip--active" : ""}`}
              onClick={() => setMode("rce")}
              aria-pressed={mode === "rce"}
            >
              RCE
            </button>
            <button
              type="button"
              className={`pv-chip ${mode === "rcem" ? "pv-chip--active" : ""}`}
              onClick={() => setMode("rcem")}
              aria-pressed={mode === "rcem"}
            >
              RCEm
            </button>
          </div>
        </div>

        <div className="pv-actions">
          <button
            type="button"
            className="pv-btn pv-btn-primary"
            disabled={!valid || loading}
            onClick={handleCompute}
            aria-disabled={!valid || loading}
          >
            {loading ? "Liczenie…" : "Oblicz"}
          </button>
          {!valid && (
            <div className="pv-help">Podaj poprawny zakres dat (Od ≤ Do). Akceptujemy DD.MM.RRRR i YYYY-MM-DD.</div>
          )}
          {error && <div className="pv-error">Błąd: {error}</div>}
        </div>
      </div>

      <div className="pv-range-summary">
        <span>
          Suma <strong>GENERATION</strong>:{" "}
          <strong>{(sumKWh ?? 0).toLocaleString("pl-PL", { maximumFractionDigits: 2 })}</strong> kWh,
        </span>{" "}
        <span>
          Suma przychodu:{" "}
          <strong>
            {(sumPLN ?? 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>{" "}
          PLN
        </span>
      </div>
    </div>
  );
}
