"use client";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function AreaChartCard({
  title, data, xKey, yKey, suffix, decimals = 1
}:{
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  suffix?: string;
  decimals?: number;
}){
  const fmt = (v:any)=> {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v ?? "");
    return n.toFixed(decimals) + (suffix ?? "");
  };
  return (
    <div className="p-5 rounded-2xl shadow-lg shadow-sky-100/40 bg-white/60 border border-white/40 backdrop-blur-xl">
      <div className="text-sm text-sky-900/70 mb-2">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fillFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} minTickGap={30} />
            <YAxis />
            <Tooltip formatter={(val)=> fmt(val)} />
            <Area type="monotone" dataKey={yKey} fill="url(#fillFade)" stroke="#0ea5e9" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
