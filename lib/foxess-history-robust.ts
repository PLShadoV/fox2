import crypto from "crypto";

type SepKind = "literal" | "crlf" | "lf";
type Point = { time?: string; timestamp?: string | number; value?: number };
export type Series = { variable: string; unit: string; values: number[] };

function buildSignature(path: string, token: string, timestamp: number, kind: SepKind) {
  const SEPS: Record<SepKind, string> = { literal: "\\r\\n", crlf: "\r\n", lf: "\n" };
  const sep = SEPS[kind];
  const plaintext = path + sep + token + sep + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
}

async function callFox(path: string, headers: Record<string,string>, bodyObj: any) {
  const url = "https://www.foxesscloud.com" + path;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyObj), cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function toISO(s: any): string | null {
  if (s == null) return null;
  const t = typeof s === "number" ? new Date(s) : new Date(String(s).replace("CEST+0200","+02:00"));
  if (isNaN(t.getTime())) return null;
  return t.toISOString();
}

function groupTo24(points: Point[], unit?: string, cutoffISO?: string){
  const cutoff = cutoffISO ? new Date(cutoffISO).getTime() : null;
  const buckets: number[] = new Array(24).fill(0);
  const pts = points.map((p: Point) => ({ ...p, iso: toISO(p.time ?? p.timestamp) })).filter(p => (p as any).iso && typeof p.value === "number") as any[];
  pts.sort((a,b)=> a.iso.localeCompare(b.iso));
  if (!pts.length) return buckets;
  for (let i=0;i<pts.length;i++){
    const cur = pts[i];
    const curDate = new Date(cur.iso);
    if (cutoff && curDate.getTime() > cutoff) break;
    const hour = curDate.getUTCHours();
    const val = Number(cur.value) || 0;
    if (!isFinite(val)) continue;
    if (unit && unit.toLowerCase() === "kwh"){
      buckets[hour] += val;
    } else {
      const next = pts[i+1];
      const nextDate = next ? new Date(next.iso) : new Date(curDate.getTime() + 60*60*1000);
      const dtEnd = cutoff && nextDate.getTime() > cutoff ? new Date(cutoff) : nextDate;
      const dtHours = Math.max(0, (dtEnd.getTime() - curDate.getTime()) / 3600000);
      buckets[hour] += val * dtHours;
    }
  }
  return buckets.map(v => +v.toFixed(3));
}

export function isValidDateStr(s?: string | null){
  return !!(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
}

export function todayStrInWarsaw(){
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const dd = String(now.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

export function currentHourInWarsaw(){
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  return now.getHours();
}

export async function foxHistoryFetchVar(sn: string, date: string, variable: string, cutoffISO?: string): Promise<Series>{
  const path = "/op/v0/device/history/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  const d0 = date + " 00:00:00";
  const d1 = date + " 23:59:59";
  const end = cutoffISO ? new Date(cutoffISO).toISOString().replace("T", " ").slice(0, 19) : d1;

  const bodies: any[] = [
    { sn, variables: [variable], dimension: "FIVE_MIN", beginDate: d0, endDate: end },
    { sn, variables: [variable], type: "FIVE_MIN", beginDate: d0, endDate: end },
    { sn, variables: [variable], dimension: "5MIN", beginDate: d0, endDate: end },
    { sn, variables: [variable], type: "5MIN", beginDate: d0, endDate: end },
    { sn, variables: [variable], dimension: "MIN5", beginDate: d0, endDate: end },
    { sn, variables: [variable], type: "MIN5", beginDate: d0, endDate: end },
    { sn, variables: [variable], dimension: "HOUR", beginDate: d0, endDate: end },
    { sn, variables: [variable], type: "HOUR", beginDate: d0, endDate: end },
    { sn, variables: [variable], dimension: "HOUR", startDate: d0, endDate: end },
    { sn, variables: [variable], type: "HOUR", startDate: d0, endDate: end },
    { sn, variables: [variable], dimension: "day", beginDate: d0, endDate: end }
  ];

  for (const kind of kinds) {
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": process.env.FOXESS_API_LANG || "pl",
      "timestamp": String(ts),
      "token": token,
      "sign": buildSignature(path, token, ts, kind),
      "signature": buildSignature(path, token, ts, kind)
    };
    for (const body of bodies) {
      const { json } = await callFox(path, headers, body);
      if (!json || typeof json.errno !== "number" || json.errno !== 0) continue;
      const res = json.result;

      if (Array.isArray(res) && res.length && (Array.isArray(res[0]?.values) || res[0]?.values == null)) {
        const entry = (res[0] || {}) as any;
        const unit = String(entry.unit || "kWh");
        const values = Array.isArray(entry.values) ? (entry.values as any[]).map((x:any)=> Number(x)||0) : new Array(24).fill(0);
        const maxv = Math.max(...values);
        let vals: number[] = values.slice() as number[];
        let u = unit;
        if (maxv > 2000) { vals = vals.map((v: number)=> v/1000); u = "kWh"; }
        const arr = new Array(24).fill(0);
        for (let i=0;i<Math.min(24, vals.length); i++) arr[i] = +Number(vals[i]).toFixed(3);
        return { variable, unit: u, values: arr };
      }

      if (Array.isArray(res) && res.length && (res[0]?.data || res[0]?.points)) {
        const entry = res[0] as any;
        const unit = String(entry.unit || "");
        const pts: Point[] = (entry.data || entry.points || []) as any[];
        const values24 = groupTo24(pts, unit, cutoffISO || undefined);
        return { variable, unit: "KWH", values: values24 };
      }

      if (Array.isArray(res) && res.length && Array.isArray(res[0]?.datas)) {
        const datas = (res[0] as any).datas;
        let best: Series | null = null;
        for (const ds of datas) {
          const unit = String(ds.unit || "");
          const pts: Point[] = (ds.data || ds.points || []) as any[];
          const values24 = groupTo24(pts, unit, cutoffISO || undefined);
          const s = values24.reduce((a:number,b:number)=>a+b,0);
          if (!best || s > best.values.reduce((x:number,y:number)=>x+y,0)) best = { variable, unit: "KWH", values: values24 };
        }
        if (best) return best;
      }

      if (res && typeof res === "object" && !Array.isArray(res)) {
        const maybe = (res as any)[variable];
        if (Array.isArray(maybe)) {
          const arr = new Array(24).fill(0);
          for (let i=0;i<Math.min(24, maybe.length); i++) arr[i] = +Number(maybe[i]||0).toFixed(3);
          return { variable, unit: "kWh", values: arr };
        }
      }
    }
  }
  return { variable, unit: "kWh", values: new Array(24).fill(0) };
}

function sum(a:number[]){ return a.reduce((x,y)=>x+y,0); }

export async function getDayExportAndGenerationKWh(sn: string, date: string){
  const EXPORT_CAND = ["feedinPower","feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut"];
  const GEN_CAND = ["generationPower","generation","production","yield","eDay","dayEnergy"];

  const exportResults: Series[] = [];
  for (const v of EXPORT_CAND) exportResults.push(await foxHistoryFetchVar(sn, date, v));
  const genResults: Series[] = [];
  for (const v of GEN_CAND) genResults.push(await foxHistoryFetchVar(sn, date, v));

  const pick = (arr: Series[], preferPower: string[]) => {
    const byName = (name:string)=> arr.find(s => s.variable.toLowerCase() === name.toLowerCase() && sum(s.values) > 0);
    for (const p of preferPower) {
      const cand = byName(p);
      if (cand) return cand;
    }
    let best = arr[0];
    for (const s of arr) if (sum(s.values) > sum(best.values)) best = s;
    return best;
  };

  const exportSeries = pick(exportResults, ["feedinPower"]);
  const genSeries = pick(genResults, ["generationPower"]);

  return { export: exportSeries, generation: genSeries };
}

export async function getDayTotals(sn: string, date: string){
  const today = todayStrInWarsaw();
  const isToday = date === today;
  const cutoffISO = isToday ? new Date().toISOString() : undefined;

  // generation
  const genVarCand = ["generationPower","generation","production","yield","eDay","dayEnergy"];
  let genSeries: Series | null = null;
  for (const v of genVarCand) {
    const s = await foxHistoryFetchVar(sn, date, v, cutoffISO);
    if (s.values.some(x=>x>0)) { genSeries = s; break; }
    if (!genSeries) genSeries = s;
  }

  // export
  const expVarCand = ["feedinPower","feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut"];
  let expSeries: Series | null = null;
  for (const v of expVarCand) {
    const s = await foxHistoryFetchVar(sn, date, v, cutoffISO);
    if (s.values.some(x=>x>0)) { expSeries = s; break; }
    if (!expSeries) expSeries = s;
  }

  const hour = currentHourInWarsaw();
  const sum = (arr:number[], upto?: number) => Array.isArray(arr) ? arr.slice(0, Math.min(arr.length, upto ?? arr.length)).reduce((x,y)=>x+y,0) : 0;
  const genTotal = +(sum(genSeries?.values||[])).toFixed(3);
  const expTotal = +(sum(expSeries?.values||[])).toFixed(3);
  const genToNow = isToday ? +(sum(genSeries?.values||[], hour).toFixed(3)) : genTotal;
  const expToNow = isToday ? +(sum(expSeries?.values||[], hour).toFixed(3)) : expTotal;

  return {
    date,
    generation: { unit: "kWh", series: genSeries?.values || new Array(24).fill(0), total: genTotal, toNow: genToNow, variable: genSeries?.variable || null },
    export: { unit: "kWh", series: expSeries?.values || new Array(24).fill(0), total: expTotal, toNow: expToNow, variable: expSeries?.variable || null }
  };
}
