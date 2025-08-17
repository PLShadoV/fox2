function parseNumber(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function toISO(date: string, hour: number): string {
  const dt = new Date(date + "T" + String(hour).padStart(2,"0") + ":00:00.000Z");
  return dt.toISOString();
}

// Normalize RCE response to 24 entries with {timeISO, rce_pln_mwh}
export async function getRCEForDate(date: string) {
  const base = process.env.PSE_RCE_BASE_URL || "https://api.raporty.pse.pl/api";
  const urls = [
    `${base}/rce-pln/reports/rbus_rce_pln_ver2_api`,
    `${base}/rce-pln/reports/rbus_rce_pln_api`,
    `${base}/rce-pln/reports`,
  ];
  // best effort: try fetch and parse various shapes
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: "no-store" });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { continue; }
      let rows: any[] = [];
      if (Array.isArray(json?.value)) rows = json.value;
      else if (Array.isArray(json?.data)) rows = json.data;
      else if (Array.isArray(json)) rows = json;
      if (!rows.length) continue;

      const out = new Array(24).fill(null).map((_,h)=>({ timeISO: toISO(date,h), rce_pln_mwh: null as number | null }));
      for (const r of rows) {
        const keys = Object.keys(r || {});
        const priceKey = keys.find(k => k.toLowerCase().includes("rce") || k.toLowerCase().includes("pln"));
        const hourKey = keys.find(k => k.toLowerCase().includes("hour") || k.toLowerCase().includes("godzina") || k.toLowerCase()==="h");
        const dateKey = keys.find(k => k.toLowerCase().includes("date") || k.toLowerCase().includes("czas") || k.toLowerCase().includes("data"));
        let hour = parseNumber(r[hourKey || "hour"]);
        if (hour == null && typeof r[dateKey||""] === "string") {
          const m = r[dateKey||""].match(/T(\d{2})/);
          if (m) hour = Number(m[1]);
        }
        if (hour == null && typeof r[dateKey||""] === "string") {
          const m = r[dateKey||""].match(/\b(\d{1,2})[:\-h]/i);
          if (m) hour = Number(m[1]);
        }
        if (hour == null) continue;
        const price = parseNumber(r[priceKey || "rce_pln_mwh"]);
        if (price == null) continue;
        const idx = Math.max(0, Math.min(23, hour));
        out[idx].rce_pln_mwh = price;
      }
      // fill forward if still nulls -> fallback constant
      let last = 0;
      for (let i=0;i<24;i++){
        if (out[i].rce_pln_mwh == null) out[i].rce_pln_mwh = last;
        else last = out[i].rce_pln_mwh!;
      }
      return out;
    } catch { /* try next */ }
  }
  // fallback: zeros
  return new Array(24).fill(null).map((_,h)=>({ timeISO: toISO(date,h), rce_pln_mwh: 0 }));
}
