"use client";

import React from "react";
import clsx from "clsx";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  highlight?: "primary" | "success" | "warning";
};

export default function StatTile({ title, value, subtitle, highlight }: Props) {
  return (
    <div
      className={clsx(
        "glass-tile p-5 rounded-2xl backdrop-blur-md",
        "border border-white/15 shadow-lg",
        "transition-transform hover:-translate-y-0.5"
      )}
    >
      <div className="text-xs tracking-wide uppercase opacity-80">{title}</div>
      <div className={clsx(
        "mt-1 text-3xl font-semibold",
        highlight === "primary" && "text-sky-300",
        highlight === "success" && "text-emerald-300",
        highlight === "warning" && "text-amber-300"
      )}>
        {value}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs opacity-70">{subtitle}</div>
      )}
    </div>
  );
}
