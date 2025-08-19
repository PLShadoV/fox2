import map from '@/public/rcem.json';
export type RCEmMap = Record<string, number>;
export function rcemFor(date: string): number | null {
  const key = date.slice(0,7);
  const m = (map as RCEmMap)[key];
  return typeof m === 'number' ? m : null;
}
export function rcemTable(): {month:string, price:number}[] {
  const m = map as RCEmMap;
  return Object.entries(m).sort(([a],[b]) => a<b ? 1 : -1).map(([k,v])=>({month:k, price:v}));
}
