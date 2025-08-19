'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export type HourPoint = { t: string; kwh: number };

export default function PowerChart({ data, title }:{ data: HourPoint[]; title: string }){
  return (
    <div className="glass">
      <div className="chart-wrap">
        <div style={{fontWeight:700, marginBottom:8}}>{title}</div>
        <div style={{width:'100%', height:300}}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#29a3ff" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#29a3ff" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{fill:'var(--muted)'}} />
              <YAxis tick={{fill:'var(--muted)'}} />
              <Tooltip contentStyle={{background:'rgba(0,0,0,0.7)', border:'none', borderRadius:10}} />
              <Area type="monotone" dataKey="kwh" stroke="#29a3ff" strokeWidth={3} fill="url(#pv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
