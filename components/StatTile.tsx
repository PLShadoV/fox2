"use client";
export default function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-5 rounded-2xl shadow-sm bg-white/60 dark:bg-zinc-900/60 backdrop-blur border border-zinc-200/60 dark:border-zinc-800 flex flex-col gap-1">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {sub ? <div className="text-xs text-zinc-400">{sub}</div> : null}
    </div>
  );
}
