"use client";
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, ResponsiveContainer } from "recharts";

export default function BarChartCard({ title, data, xKey, yKey }:{ title: string; data: any[]; xKey: string; yKey: string; }) {
  return (
    <div className="card p-4">
      <div className="font-semibold mb-3">{title}</div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={yKey} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
