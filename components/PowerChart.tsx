"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Point = { t: string; kw: number };

export default function PowerChart({ points, title }: { points: Point[]; title: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="text-sm opacity-80 mb-2">{title}</div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <AreaChart data={points}>
            <defs>
              <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--pv-accent)" stopOpacity={0.7} />
                <stop offset="100%" stopColor="var(--pv-accent)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="t" tick={{ fontSize: 12 }} minTickGap={32} />
            <YAxis width={38} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v: any) => [`${Number(v).toFixed(2)} kW`, "Moc"]}
              labelFormatter={(l) => `${l}`}
            />
            <Area
              type="monotone"
              dataKey="kw"
              stroke="var(--pv-accent)"
              fill="url(#pvGrad)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}