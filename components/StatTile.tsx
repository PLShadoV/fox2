'use client';
import React from 'react';

type StatTileProps = {
  /** Preferred prop names */
  title?: string;
  subtitle?: string;

  /** Backwards-compatible aliases */
  label?: string;
  sub?: string;

  /** Displayed main value (already formatted) */
  value: string;
  className?: string;
};

/**
 * Glass-style stat tile. Accepts both (title/subtitle) and legacy (label/sub) props.
 */
export default function StatTile(props: StatTileProps) {
  const heading = (props.title ?? props.label ?? '').trim();
  const subline = (props.subtitle ?? props.sub)?.trim();
  const cls = `pv-card pv-card--glass pv-stat ${props.className ?? ''}`.trim();

  return (
    <div className={cls}>
      {heading && <div className="pv-stat-title">{heading}</div>}
      <div className="pv-stat-value">{props.value}</div>
      {subline && <div className="pv-stat-sub">{subline}</div>}
    </div>
  );
}
