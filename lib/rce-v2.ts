const PSE_API_BASE = process.env.PSE_API_BASE || "https://api.raporty.pse.pl/api";

type RceRow = { rce_pln?: number|string, dtime?: string, period?: string|number, period_utc?: string|number, business_date?: string };
type RceOut = { timeISO: string; rce_pln_mwh: number };

function toNumber(x:any){
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function hourFromPeriod(p:any){
  if (p==null) return null;
  if (typeof p === "number") return Math.max(0, Math.min(23, Math.floor(p)));
  const s = String(p);
  // "01:00", "01:00:00", "1", "PT1H", "H01", etc.
  const m = s.match(/(\d{1,2})/);
  if (m) {
    const h = Number(m[1]);
    if (Number.isFinite(h)) return Math.max(0, Math.min(23, h));
  }
  return null;
}

export async function fetchRCEv2(day: string){
  // Build OData-like query for v2
  const url = new URL(PSE_API_BASE + "/rce-pln");
  url.searchParams.set("$filter", `business_date eq '${day}'`);
  url.searchParams.set("$orderby", "dtime asc");
  url.searchParams.set("$select", "rce_pln,dtime,period,period_utc,business_date");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`PSE RCE ${res.status}: ${txt.slice(0,200)}`);
  }
  let body:any = await res.json().catch(()=>null);
  // API may return either { value: [...] } or raw array
  const rows: RceRow[] = Array.isArray(body?.value) ? body.value
                    : Array.isArray(body) ? body
                    : Array.isArray(body?.rows) ? body.rows : [];

  const items: RceOut[] = [];
  for (const row of rows) {
    const price = toNumber((row as any).rce_pln);
    const baseDate = (row as any).dtime || (row as any).business_date || day;
    const h = hourFromPeriod((row as any).period ?? (row as any).period_utc);
    let iso = "";
    try {
      if (typeof baseDate === "string" && baseDate.length >= 10) {
        if (h!=null) {
          const [Y,M,D] = baseDate.slice(0,10).split("-").map(Number);
          iso = new Date(Date.UTC(Y, (M||1)-1, D||1, h)).toISOString();
        } else {
          iso = new Date(baseDate).toISOString();
        }
      }
    } catch {}
    if (!iso) iso = new Date(day + "T00:00:00Z").toISOString();
    items.push({ timeISO: iso, rce_pln_mwh: price });
  }

  // Normalize to 24 hours
  const start = new Date(day + "T00:00:00Z").getTime();
  const byHour = new Map<number, number>();
  for (const it of items) {
    const h = new Date(it.timeISO).getUTCHours();
    if (!Number.isFinite(h)) continue;
    byHour.set(h, it.rce_pln_mwh);
  }

  const out: RceOut[] = [];
  for (let h=0; h<24; h++){
    const t = new Date(start + h*3600_000).toISOString();
    const v = byHour.has(h) ? byHour.get(h)! : NaN;
    out.push({ timeISO: t, rce_pln_mwh: v });
  }
  return { ok:true, date: day, rows: out, rawCount: rows.length };
}
