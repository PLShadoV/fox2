import crypto from "crypto";
import { foxReportQuery } from "@/lib/foxess";

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
      buckets[hour] += val * dtHours / 1000; // W→kWh
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

// --- NEW: prefer report/day for energy series ---
async function fetchDaySeriesPreferReport(sn: string, date: string, candidates: string[]): Promise<Series|null>{
  try {
    const [y,m,d] = date.split("-").map(Number);
    const res = await foxReportQuery({ sn, year: y, month: m, day: d, dimension: "day", variables: candidates });
    if (Array.isArray(res) && res.length){
      // pick the first with non-zero sum
      const pick = (a:any[]) => {
        let best:any = null;
        for (const r of a){
          const vals = Array.isArray(r?.values) ? r.values.map((x:any)=> Number(x)||0) : [];
          let unit = String(r?.unit || "kWh");
          const maxv = Math.max(0, ...vals);
          let v = vals.slice();
          if (unit.toLowerCase() === "kwh" && maxv > 2000) { v = v.map((x:number)=> x/1000); } // Wh→kWh
          const arr = new Array(24).fill(0);
          for (let i=0;i<Math.min(24, v.length); i++) arr[i] = +Number(v[i]).toFixed(3);
          const sum = arr.reduce((x:number,y:number)=>x+y,0);
          const item = { variable: String(r.variable||""), unit: "kWh", values: arr };
          if (sum > 0) return item;
          if (!best) best = item;
        }
        return best;
      };
      const found = pick(res);
      if (found) return found;
    }
  } catch {}
  return null;
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
        return { variable, unit: "kWh", values: values24 };
      }

      if (Array.isArray(res) && res.length && Array.isArray(res[0]?.datas)) {
        const datas = (res[0] as any).datas;
        let best: Series | null = null;
        for (const ds of datas) {
          const unit = String(ds.unit || "");
          const pts: Point[] = (ds.data || ds.points || []) as any[];
          const values24 = groupTo24(pts, unit, cutoffISO || undefined);
          const s = values24.reduce((a:number,b:number)=>a+b,0);
          if (!best || s > best.values.reduce((x:number,y:number)=>x+y,0)) best = { variable, unit: "kWh", values: values24 };
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
  const GEN_CAND = ["generation","yield","eDay","dayEnergy","generationPower","production"];

  // Prefer REPORT for both
  const repGen = await fetchDaySeriesPreferReport(sn, date, GEN_CAND);
  const repExp = await fetchDaySeriesPreferReport(sn, date, EXPORT_CAND);

  const genSeries = repGen || await foxHistoryFetchVar(sn, date, "generationPower");
  const expSeries = repExp || await foxHistoryFetchVar(sn, date, "feedinPower");

  return { export: expSeries, generation: genSeries };
}

export async function getDayTotals(sn: string, date: string){
  const today = todayStrInWarsaw();
  const isToday = date === today;
  const cutoffISO = isToday ? new Date().toISOString() : undefined;

  const GEN_CAND = ["generation","yield","eDay","dayEnergy","generationPower","production"];
  let genSeries: Series | null = await fetchDaySeriesPreferReport(sn, date, GEN_CAND);
  if (!genSeries) genSeries = await foxHistoryFetchVar(sn, date, "generationPower", cutoffISO);

  const EXP_CAND = ["feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut","feedinPower"];
  let expSeries: Series | null = await fetchDaySeriesPreferReport(sn, date, EXP_CAND);
  if (!expSeries) expSeries = await foxHistoryFetchVar(sn, date, "feedinPower", cutoffISO);

  const hour = currentHourInWarsaw();
  const sumTo = (arr:number[], upto?: number) => Array.isArray(arr) ? arr.slice(0, Math.min(arr.length, upto ?? arr.length)).reduce((x,y)=>x+y,0) : 0;
  const genTotal = +(sumTo(genSeries?.values||[])).toFixed(3);
  const expTotal = +(sumTo(expSeries?.values||[])).toFixed(3);
  const genToNow = isToday ? +(sumTo(genSeries?.values||[], hour).toFixed(3)) : genTotal;
  const expToNow = isToday ? +(sumTo(expSeries?.values||[], hour).toFixed(3)) : expTotal;

  return {
    date,
    generation: { unit: "kWh", series: genSeries?.values || new Array(24).fill(0), total: genTotal, toNow: genToNow, variable: genSeries?.variable || null },
    export: { unit: "kWh", series: expSeries?.values || new Array(24).fill(0), total: expTotal, toNow: expToNow, variable: expSeries?.variable || null }
  };
}
