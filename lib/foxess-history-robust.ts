import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

type SepKind = "literal" | "crlf" | "lf";
type Point = { time?: string; timestamp?: string | number; value?: number };

function buildSignature(path: string, token: string, timestamp: number, kind: SepKind) {
  const SEPS: Record<SepKind, string> = { literal: "\\r\\n", crlf: "\r\n", lf: "\n" };
  const sep = SEPS[kind];
  const plaintext = path + sep + token + sep + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
}

async function callFox(path: string, headers: Record<string,string>, bodyObj: any) {
  const url = FOX_DOMAIN + path;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyObj), cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function toDateISO(s: any): string | null {
  if (s == null) return null;
  const t = typeof s === "number" ? new Date(s) : new Date(String(s).replace("CEST+0200","+02:00"));
  if (isNaN(t.getTime())) return null;
  return t.toISOString();
}

function groupTo24(points: Point[], unit?: string){
  // returns 24-length kWh array
  // if unit is kWh and points are hourly, we just bucket by hour and sum
  // if unit is kW (power), integrate by time difference (kW * h)
  const buckets: number[] = new Array(24).fill(0);
  // sort by time
  const pts = points.map(p => ({ ...p, iso: toDateISO(p.time ?? p.timestamp) })).filter(p => p.iso && typeof p.value === "number") as any[];
  pts.sort((a,b)=> a.iso.localeCompare(b.iso));
  if (!pts.length) return buckets;
  for (let i=0;i<pts.length;i++){
    const cur = pts[i];
    const curDate = new Date(cur.iso);
    const hour = curDate.getUTCHours();
    const val = Number(cur.value) || 0;
    if (!isFinite(val)) continue;
    if (unit && unit.toLowerCase() === "kwh"){
      buckets[hour] += val;
    } else {
      // integrate as power kW over delta time to next point
      const next = pts[i+1];
      const nextDate = next ? new Date(next.iso) : new Date(curDate.getTime() + 60*60*1000);
      const dtHours = Math.max(0, (nextDate.getTime() - curDate.getTime()) / 3600000);
      buckets[hour] += val * dtHours;
    }
  }
  return buckets.map(v => +v.toFixed(3));
}

export async function foxHistoryFetchVar(sn: string, date: string, variable: string){
  const path = "/op/v0/device/history/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  const d0 = date + " 00:00:00";
  const d1 = date + " 23:59:59";

  const bodies: any[] = [
    { sn, variables: [variable], dimension: "HOUR", beginDate: d0, endDate: d1 },
    { sn, variables: [variable], type: "HOUR", beginDate: d0, endDate: d1 },
    { sn, variables: [variable], dimension: "HOUR", startDate: d0, endDate: d1 },
    { sn, variables: [variable], type: "HOUR", startDate: d0, endDate: d1 },
    { sn, variables: [variable], dimension: "day", beginDate: d0, endDate: d1 },
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
      const { json, text } = await callFox(path, headers, body);
      if (!json || typeof json.errno !== "number") continue;
      if (json.errno !== 0) continue;
      const res = json.result;
      // Possible shapes we normalize into 24-kWh values
      // 1) [{ variable, unit, values: number[] }]
      if (Array.isArray(res) && res.length && res[0] && (Array.isArray(res[0].values) || res[0].values === null || res[0].values === undefined)) {
        const entry = res[0];
        const unit = String(entry.unit || "").toLowerCase();
        const values = Array.isArray(entry.values) ? entry.values.map((x:any)=> Number(x)||0) : [];
        if (values.length === 24) {
          return { variable: variable, unit: unit || "kWh", values };
        } else if (values.length > 0) {
          // pad/trim to 24
          const arr = new Array(24).fill(0);
          for (let i=0;i<Math.min(24, values.length); i++) arr[i] = +Number(values[i]).toFixed(3);
          return { variable: variable, unit: unit || "kWh", values: arr };
        }
      }
      // 2) [{ variable, unit, data: [{time,value}...] }] OR points
      if (Array.isArray(res) && res.length && (res[0].data || res[0].points)) {
        const entry = res[0];
        const unit = String(entry.unit || "").toLowerCase();
        const pts: Point[] = (entry.data || entry.points || []) as any[];
        const values24 = groupTo24(pts, unit);
        return { variable: variable, unit: unit || "kWh", values: values24 };
      }
      // 3) [{ datas: [{ unit, data:[{time,value}...] } , ... ] }]
      if (Array.isArray(res) && res.length && Array.isArray(res[0].datas)) {
        // find dataset that likely corresponds to our variable (heuristic using unit/type keywords)
        const datas = res[0].datas;
        let best: any = null;
        for (const ds of datas) {
          if (!best) best = ds;
          const name = String(ds.name || ds.variable || "").toLowerCase();
          if (name.includes(variable.toLowerCase())) { best = ds; break; }
        }
        const unit = String(best?.unit || "").toLowerCase();
        const pts: Point[] = (best?.data || best?.points || []) as any[];
        const values24 = groupTo24(pts, unit);
        return { variable: variable, unit: unit || "kWh", values: values24 };
      }
      // 4) object map
      if (res && typeof res === "object" && !Array.isArray(res)) {
        const maybe = (res as any)[variable];
        if (Array.isArray(maybe)) {
          const values = maybe.map((x:any)=> Number(x)||0);
          const arr = new Array(24).fill(0);
          for (let i=0;i<Math.min(24, values.length); i++) arr[i] = +Number(values[i]).toFixed(3);
          return { variable: variable, unit: "kWh", values: arr };
        }
      }
    }
  }
  return { variable, unit: "kWh", values: new Array(24).fill(0) };
}

export async function foxHistoryDayNormalized({ sn, date, exportVars, genVars }:{ sn:string; date:string; exportVars:string[]; genVars:string[] }){
  const out: any[] = [];
  for (const v of exportVars) {
    try { out.push(await foxHistoryFetchVar(sn, date, v)); } catch { out.push({ variable: v, unit: "kWh", values: new Array(24).fill(0) }); }
  }
  for (const v of genVars) {
    try { out.push(await foxHistoryFetchVar(sn, date, v)); } catch { out.push({ variable: v, unit: "kWh", values: new Array(24).fill(0) }); }
  }
  return out;
}
