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
      <div className="glass-title">{title}</div>
      <div className="glass-value">{value}</div>
      {subtitle && <div className="glass-sub">{subtitle}</div>}
    </div>
  );
}
