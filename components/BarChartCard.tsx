"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function BarChartCard({ title, data, xKey, yKey, suffix, decimals = 0 }: {
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
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip formatter={(val)=> fmt(val)} />
            <Bar dataKey={yKey} fill="#0ea5e9" radius={[8,8,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
