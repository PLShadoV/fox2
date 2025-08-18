"use client";

import React from "react";
import clsx from "clsx";

type NewProps = {
  title?: string;
  value: string;
  subtitle?: string;
  highlight?: "primary" | "success" | "warning";
  // Backward-compat props (old usage in DashboardClient)
  label?: string;
  sub?: string;
};

/**
 * StatTile now supports BOTH the new API ({ title, subtitle })
 * and the old API ({ label, sub }). This keeps existing code working.
 */
export default function StatTile(props: NewProps) {
  const title = props.title ?? props.label ?? "";
  const subtitle = props.subtitle ?? props.sub;

  return (
    <div
      className={clsx(
        "glass-tile p-5 rounded-2xl backdrop-blur-md",
        "border border-white/15 shadow-lg",
        "transition-transform hover:-translate-y-0.5"
      )}
    >
      <div className="text-xs tracking-wide uppercase opacity-80">{title}</div>
      <div
        className={clsx(
          "mt-1 text-3xl font-semibold",
          props.highlight === "primary" && "text-sky-300",
          props.highlight === "success" && "text-emerald-300",
          props.highlight === "warning" && "text-amber-300"
        )}
      >
        {props.value}
      </div>
      {subtitle && <div className="mt-1 text-xs opacity-70">{subtitle}</div>}
    </div>
  );
}
