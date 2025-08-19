// components/StatTile.tsx
"use client";
import React from "react";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
};

export default function StatTile({ title, value, subtitle }: Props) {
  return (
    <div className="glass-tile">
      <div className="tile-title">{title}</div>
      <div className="tile-value">{value}</div>
      {subtitle ? <div className="tile-sub">{subtitle}</div> : null}
    </div>
  );
}
