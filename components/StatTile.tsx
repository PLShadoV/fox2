'use client';
import React from 'react';

export default function StatTile(
  { title, value, subtitle }:
  { title: string, value: string, subtitle?: string }
) {
  return (
    <div className="pv-card p-6 shadow-md">
      <div className="text-sm opacity-80">{title}</div>
      <div className="mt-1 text-4xl font-bold tracking-tight">{value}</div>
      {subtitle && <div className="mt-2 text-sm opacity-75">{subtitle}</div>}
    </div>
  );
}