import rcem from "../data/rcem.json";

export type RCEmRow = { ym: string; pln_mwh: number };

export function getRCEmMap(): Record<string, number> {
  const map: Record<string, number> = {};
  (rcem as RCEmRow[]).forEach(r => { map[r.ym] = r.pln_mwh; });
  return map;
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
