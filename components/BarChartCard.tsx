"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function formatVal(v: any){
  const n = Number(v);
  if (Number.isFinite(n)) return n % 1 === 0 ? n.toString() : n.toFixed(2);
  return String(v ?? "");
}

type Props = {
  title: string;
  data: any[];
  xKey: string;
  yKey: string;
  name?: string;
};

export default function BarChartCard({ title, data, xKey, yKey, name }: Props) {
  return (
    <div className="card p-4">
      <div className="text-base font-medium mb-3">{title}</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value) => [formatVal(value), name || yKey]}
              labelFormatter={(label) => String(label)}
            />
            <Bar dataKey={yKey} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
