"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function BarChartCard({ title, data, xKey, yKey, formatter }: {
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  formatter?: (v:any)=> string;
}){
  return (
    <div className="p-5 rounded-2xl shadow-sm bg-white/60 dark:bg-zinc-900/60 backdrop-blur border border-zinc-200/60 dark:border-zinc-800">
      <div className="text-sm text-zinc-500 mb-2">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip formatter={(v:any)=> formatter ? formatter(v) : v} />
            <Bar dataKey={yKey} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
