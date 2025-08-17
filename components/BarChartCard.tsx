"use client";
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, ResponsiveContainer, Label } from "recharts";

export default function BarChartCard({ title, data, xKey, yKey }:{ title: string; data: any[]; xKey: string; yKey: string; }) {
  return (
    <div className="card p-4">
      <div className="font-semibold mb-3">{title}</div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={data} barSize={24}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey={xKey}>
              <Label value="Godzina" position="insideBottom" offset={-6} />
            </XAxis>
            <YAxis />
            <Tooltip formatter={(v)=> Array.isArray(v) ? v : String(v)} />
            <Legend />
            <Bar dataKey={yKey} radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
