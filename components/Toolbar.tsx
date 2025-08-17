"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";

const ranges = [
  { key: "today", label: "Dzisiaj" },
  { key: "yesterday", label: "Wczoraj" },
  { key: "week", label: "Ten tydzień" },
  { key: "month", label: "Ten miesiąc" },
  { key: "year", label: "Ten rok" }
];

export default function Toolbar(){
  const router = useRouter();
  const sp = useSearchParams();
  const date = sp.get("date") || format(new Date(), "yyyy-MM-dd");

  const setRange = (r: string) => {
    const params = new URLSearchParams(sp);
    params.set("range", r);
    if (r==="today") params.set("date", format(new Date(), "yyyy-MM-dd"));
    router.push("/?"+params.toString());
  };
  const setDate = (d: string) => {
    const params = new URLSearchParams(sp);
    params.set("date", d);
    params.set("range", "day");
    router.push("/?"+params.toString());
  };

  return (
    <div className="card p-3 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
      <div className="toolbar">
        {ranges.map(r => (
          <button key={r.key} className="btn btn-ghost" onClick={()=>setRange(r.key)}>{r.label}</button>
        ))}
      </div>
      <div className="toolbar">
        <input type="date" className="border rounded-lg px-3 py-2" value={date} onChange={e=>setDate(e.target.value)} />
      </div>
    </div>
  );
}
