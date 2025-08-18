"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  chipClass?: string;
  activeClass?: string;
};

function toISODateLocal(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export default function RangeButtons({ chipClass = "", activeClass = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const today = useMemo(() => toISODateLocal(new Date()), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISODateLocal(d);
  }, []);

  const dateParam = sp.get("date") || today;
  const isToday = dateParam === today;
  const isYesterday = dateParam === yesterday;

  function pushWithDate(dateStr: string) {
    const search = new URLSearchParams(sp.toString());
    search.set("date", dateStr);
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`${chipClass} ${isToday ? activeClass : ""}`.trim()}
        onClick={() => pushWithDate(today)}
      >
        Dziś
      </button>
      <button
        type="button"
        className={`${chipClass} ${isYesterday ? activeClass : ""}`.trim()}
        onClick={() => pushWithDate(yesterday)}
      >
        Wczoraj
      </button>

      <input
        type="date"
        value={dateParam}
        onChange={(e) => {
          const v = e.currentTarget.value || today;
          pushWithDate(v);
        }}
        className={(chipClass + " glass-focus").trim()}
      />
    </div>
  );
}
