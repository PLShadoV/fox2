"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot, Area } from "recharts";

export default function PowerCurveCard({
  title, data, xKey, yKey, unit = "kW", showLatest = true
}:{
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  unit?: string;
  showLatest?: boolean;
}){
  const last = data?.length ? data[data.length - 1] : null;
  return (
    <div className="pv-card p-5">
      <div className="text-sm mb-2 pv-title/60">{title}</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <defs>
              <linearGradient id="powFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                <stop offset="60%" stopColor="#38bdf8" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} minTickGap={30} />
            <YAxis tickFormatter={(v)=> String(v)} label={{ value: unit, angle: -90, position: "insideLeft" }} />
            <Tooltip formatter={(val)=> `${Number(val).toFixed(2)} ${unit}`} />
            <Area type="monotone" dataKey={yKey} fill="url(#powFill)" stroke="none" />
            <Line type="monotone" dataKey={yKey} stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={500} />
            {showLatest && last ? (
              <ReferenceDot x={last[xKey]} y={last[yKey]} r={4} fill="#0ea5e9" />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
