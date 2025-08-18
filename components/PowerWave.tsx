"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot
} from "recharts";

type Pt = { x: number; kw: number; label: string };

function fmtHM(d: Date) {
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

export default function PowerWave({ date }: { date: string }) {
  const [data, setData] = useState<Pt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setError(null); setData([]);
    fetch(`/api/foxess/power?date=${date}`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        if (cancel) return;
        if (!j.ok) { setError(j.error || "Błąd"); return; }
        const pts: Pt[] = (j.points || []).map((p:any) => {
          const t = new Date(p.t);
          return { x: p.t, kw: Math.max(0, p.kw || 0), label: fmtHM(t) };
        });
        setData(pts);
      }).catch(e => setError(String(e)));
    return () => { cancel = true; };
  }, [date]);

  const nowX = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    if (date !== today) return null;
    return Date.now();
  }, [date]);

  return (
    <div className="w-full h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="2%" stopColor="#4ac1ff" stopOpacity={0.8}/>
              <stop offset="98%" stopColor="#4ac1ff" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => fmtHM(new Date(v))}
            tick={{ fill: "var(--muted-foreground,#9aa4b2)" }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground,#9aa4b2)" }}
            width={36}
            domain={[0, "auto"]}
            label={{ value: "kW", angle: -90, position: "insideLeft", fill: "var(--muted-foreground,#9aa4b2)" }}
          />
          <Tooltip
            formatter={(v:any) => [`${Number(v).toFixed(2)} kW`, "moc"]}
            labelFormatter={(v:any)=> fmtHM(new Date(v))}
          />
          <Area
            type="monotoneX"
            dataKey="kw"
            stroke="#32a8ff"
            strokeWidth={3}
            fill="url(#pvGrad)"
            isAnimationActive={false}
          />
          {nowX && <ReferenceDot x={nowX} y={0} r={0} />}
        </AreaChart>
      </ResponsiveContainer>
      {error && <div className="text-amber-400 text-sm mt-2">Błąd pobierania mocy: {error}</div>}
    </div>
  );
}
