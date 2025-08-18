"use client";
export default function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-5 rounded-2xl shadow-lg shadow-sky-100/40 bg-white/60 border border-white/40 backdrop-blur-xl flex flex-col gap-1">
      <div className="text-sm text-sky-900/70">{label}</div>
      <div className="text-3xl font-semibold tracking-tight text-sky-900">{value}</div>
      {sub ? <div className="text-xs text-sky-800/60">{sub}</div> : null}
    </div>
  );
}
