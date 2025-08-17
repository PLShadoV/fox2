export type RceRow = Record<string, any>;

const BASE = process.env.PSE_RCE_BASE_URL || "https://api.raporty.pse.pl/api";

export async function fetchRCEForDate(dateISO: string): Promise<{ timeISO: string; rce_pln_mwh: number }[]> {
  const params = new URLSearchParams();
  params.set("$filter", `business_date eq '${dateISO}'`);
  params.set("$orderby", "business_date asc");
  const url = `${BASE}/rce-pln?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`PSE RCE ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const rows: RceRow[] = Array.isArray(json) ? json : json.value || [];

  const pickPriceKey = (keys: string[]) => {
    const lower = keys.map(k => k.toLowerCase());
    const candidates = ["rce_pln", "rce", "price", "cena_pln_mwh", "cena"];
    for (const cand of candidates) {
      const i = lower.indexOf(cand);
      if (i >= 0) return keys[i];
    }
    for (const k of keys) {
      if (k === "business_date") continue;
      const v = rows[0]?.[k];
      if (typeof v === "number") return k;
    }
    return "rce_pln";
  };

  const pickTimeKey = (keys: string[]) => {
    const lower = keys.map(k => k.toLowerCase());
    const candidates = ["udtczas", "czas", "godzina", "timestamp", "ts", "datehour", "datetime"];
    for (const cand of candidates) {
      const i = lower.indexOf(cand);
      if (i >= 0) return keys[i];
    }
    return "";
  };

  if (rows.length === 0) return [];

  const keys = Object.keys(rows[0] || {});
  const priceKey = pickPriceKey(keys);
  const timeKey = pickTimeKey(keys);

  let out: { timeISO: string; rce_pln_mwh: number }[] = [];

  if (timeKey) {
    out = rows.map(r => {
      const rawTime = r[timeKey];
      const timeISO = new Date(rawTime).toISOString();
      const price = Number(r[priceKey] ?? 0);
      return { timeISO, rce_pln_mwh: price };
    });
  } else {
    out = rows.map((r, idx) => {
      const price = Number(r[priceKey] ?? 0);
      const d = new Date(dateISO + "T00:00:00Z");
      d.setUTCHours(idx);
      return { timeISO: d.toISOString(), rce_pln_mwh: price };
    });
  }

  // Group to 24 hourly points (average if multiple per hour)
  const buckets: Record<string, number[]> = {};
  for (const r of out) {
    const d = new Date(r.timeISO);
    const key = String(d.getUTCHours()).padStart(2,'0');
    (buckets[key] ||= []).push(Number(r.rce_pln_mwh));
  }
  const hourly: { timeISO: string; rce_pln_mwh: number }[] = [];
  for (let h=0; h<24; h++){
    const key = String(h).padStart(2,'0');
    const arr = buckets[key] || [];
    const avg = arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
    const d = new Date(dateISO + "T00:00:00Z");
    d.setUTCHours(h);
    hourly.push({ timeISO: d.toISOString(), rce_pln_mwh: +avg.toFixed(2) });
  }
  return hourly;
}
