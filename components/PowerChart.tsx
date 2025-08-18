'use client';
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export type Point = { t: string; kw: number };

function formatTime(t: string){
  // Expect HH:MM or HH:MM:SS -> show HH:MM
  if (!t) return '';
  const parts = t.split(':');
  return parts[0].padStart(2,'0') + ':' + parts[1].padStart(2,'0');
}

export default function PowerChart({ data, title }:{ data: Point[]; title: string }){
  return (
    <div className="pv-panel">
      <h4>{title}</h4>
      <div className="pv-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22b7f7" stopOpacity={0.6}/>
                <stop offset="100%" stopColor="#22b7f7" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
            <XAxis dataKey="t" tickFormatter={formatTime} tick={{ fill: '#a9bfd8' }} />
            <YAxis tick={{ fill: '#a9bfd8' }} width={40}/>
            <Tooltip formatter={(v:any)=>[v+' kW','moc']} labelFormatter={formatTime}
              contentStyle={{ background: 'rgba(10,20,36,.95)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#dbe7f5' }}
            />
            <Area dataKey="kw" type="monotone" stroke="#22b7f7" fill="url(#pvGrad)" strokeWidth={3} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}