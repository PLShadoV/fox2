"use client";

import React from "react";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
};

export default function StatTile({ title, value, subtitle }: Props) {
  return (
    <div className="glass-tile px-6 py-5 rounded-2xl shadow-lg">
      <div className="text-sm opacity-80">{title}</div>
      <div className="mt-2 text-4xl font-semibold tracking-tight">{value}</div>
      {subtitle ? <div className="mt-2 text-xs opacity-70">{subtitle}</div> : null}
    </div>
  );
}