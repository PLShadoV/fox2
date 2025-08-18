'use client';
import React from 'react';
type Props = { title: string; value: string; subtitle?: string };
export default function StatTile({ title, value, subtitle }: Props){
  return (
    <div className="pv-tile">
      <h3>{title}</h3>
      <div className="pv-value">{value}</div>
      {subtitle ? <div className="pv-sub">{subtitle}</div> : null}
    </div>
  );
}