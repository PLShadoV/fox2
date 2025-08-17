export type RceRow = {
  business_date: string; // YYYY-MM-DD
  udtczas: string;       // local timestamp (e.g. '2025-08-17 13:00')
  rce_pln: number;       // PLN/MWh
};

const BASE = process.env.PSE_RCE_BASE_URL || "https://api.raporty.pse.pl/api";

export async function fetchRCEForDate(dateISO: string): Promise<RceRow[]> {
  const params = new URLSearchParams();
  params.set("$filter", `business_date eq '${dateISO}'`);
  params.set("$select", "business_date,udtczas,rce_pln");
  params.set("$orderby", "udtczas asc");
  const url = `${BASE}/rce-pln?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`PSE RCE ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json.value;
  return (rows || []) as RceRow[];
}
