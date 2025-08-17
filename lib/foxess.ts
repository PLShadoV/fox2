import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";
type SepKind = "literal" | "crlf" | "lf";

function kwToW(val:any, unit?:string){
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return unit && unit.toLowerCase() === 'kw' ? Math.round(n*1000) : Math.round(n);
}

function buildSignature(path: string, token: string, timestamp: number, kind: SepKind) {
  const SEPS: Record<SepKind, string> = {
    literal: "\\r\\n",
    crlf: "\r\n",
    lf: "\n"
  };
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

export async function foxReportQuery({ sn, year, month, day, dimension, variables, lang = process.env.FOXESS_API_LANG || "pl", }:{
  sn: string; year: number; month?: number; day?: number; dimension: FoxReportDim; variables: string[]; lang?: string;
}){
  const path = "/op/v0/device/report/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const body:any = { sn, year, dimension, variables };
  if (month) body.month = month;
  if (day) body.day = day;
  const order: SepKind[] = ["literal", "crlf", "lf"];
  let lastErr: string | null = null;
  for (const kind of order) {
    const sign = buildSignature(path, token, ts, kind);
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": lang,
      "language": lang,
      "timestamp": String(ts),
      "token": token,
      "sign": sign,
      "signature": sign
    };
    const { res, json, text } = await callFox(path, headers, body);
    if (!res.ok) { lastErr = `FoxESS ${res.status}: ${text}`; break; }
    if (json && typeof json.errno === "number") {
      if (json.errno === 0) return json.result as Array<{ variable: string; unit: string; values: number[] }>;
      if (json.errno === 40256) { lastErr = `FoxESS API error 40256 (separator=${kind})`; continue; }
      if (json.errno === 40257) { lastErr = `FoxESS API error 40257: Parametr nie spełnia oczekiwań`; break; }
      lastErr = `FoxESS API error ${json.errno}: ${json.msg || ""}`; break;
    } else { lastErr = `FoxESS: unexpected response: ${text}`; break; }
  }
  throw new Error(lastErr || "FoxESS: unknown error");
}

export async function foxReportQuerySplit({ sn, date, exportVars, genVars, lang }:{ sn:string; date:string; exportVars:string[]; genVars:string[]; lang?: string; }){
  const [y,m,d] = date.split("-").map(Number);
  let exportPart: any[] = [];
  let genPart: any[] = [];
  try { exportPart = await foxReportQuery({ sn, year: y, month: m, day: d, dimension: "day", variables: exportVars, lang }); } catch {}
  try { genPart = await foxReportQuery({ sn, year: y, month: m, day: d, dimension: "day", variables: genVars, lang }); } catch {}
  return [...exportPart, ...genPart];
}

export async function foxRealtimeQuery({ sn, variables = ["pvPower","pv1Power","pv2Power","pvPowerW","generationPower","inverterPower","outputPower","ppv","ppvTotal","gridExportPower","feedinPower","acPower"] }:{ sn:string; variables?: string[] }){
  const path = "/op/v0/device/real/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  const body: any = { sn, variables };
  for (const kind of kinds) {
    const sign = buildSignature(path, token, ts, kind);
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": process.env.FOXESS_API_LANG || "pl",
      "timestamp": String(ts),
      "token": token,
      "sign": sign,
      "signature": sign
    };
    const { text } = await callFox(path, headers, body);
    try {
      const json = JSON.parse(text);
      if (typeof json?.errno === "number" && json.errno === 0) {
        const raw = json.result || [];
        let pool: any[] = [];
        if (Array.isArray(raw)) {
          if (raw.length && Array.isArray(raw[0]?.datas)) pool = raw[0].datas;
          else pool = raw;
        } else if (Array.isArray(raw?.datas)) {
          pool = raw.datas;
        } else {
          pool = Object.keys(raw||{}).map(k => ({ variable: k, value: (raw as any)[k] }));
        }
        const lower = (s:string)=> (s||'').toLowerCase();
        let val: number | null = null;
        for (const v of pool) {
          const name = lower(v.variable || v.name || "");
          const unit = v.unit;
          const isWanted = variables.map(lower).some(w => name.includes(w)) || (name.includes('pv') && name.includes('power')) || name==='ppv' || name==='ppvtotal';
          if (!isWanted) continue;
          const candidates = [v.value, v.val, v.power, v.p, Array.isArray(v.values) ? v.values.slice(-1)[0]?.value : undefined];
          for (const c of candidates) {
            const w = kwToW(c, unit);
            if (w !== null) { val = w; break; }
          }
          if (val !== null) break;
        }
        return { pvNowW: val };
      }
      if (json?.errno === 40256) continue;
    } catch {}
  }
  return { pvNowW: null };
}

export async function foxPing(){
  const path = "/op/v0/device/list";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  const out: any = {};
  for (const kind of kinds) {
    const sign = buildSignature(path, token, ts, kind);
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": process.env.FOXESS_API_LANG || "pl",
      "timestamp": String(ts),
      "token": token,
      "sign": sign,
      "signature": sign
    };
    const url = FOX_DOMAIN + path;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ currentPage: 1, pageSize: 1 }), cache: "no-store" });
    out[kind] = { ok: res.ok, status: res.status, text: await res.text() };
  }
  return out;
}

export async function foxRealtimeRaw(sn: string, variables: string[]){
  const path = "/op/v0/device/real/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  const body: any = { sn, variables };
  for (const kind of kinds) {
    const sign = buildSignature(path, token, ts, kind);
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": process.env.FOXESS_API_LANG || "pl",
      "timestamp": String(ts),
      "token": token,
      "sign": sign,
      "signature": sign
    };
    const url = FOX_DOMAIN + path;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json?.errno === "number" && json.errno === 0) {
        const raw = json.result || [];
        let pool: any[] = [];
        if (Array.isArray(raw)) {
          if (raw.length && Array.isArray(raw[0]?.datas)) pool = raw[0].datas;
          else pool = raw;
        } else if (Array.isArray(raw?.datas)) {
          pool = raw.datas;
        } else {
          pool = Object.keys(raw||{}).map(k => ({ variable: k, value: (raw as any)[k] }));
        }
        const lower = (s:string)=> (s||'').toLowerCase();
        let val: number | null = null, matched: string | null = null, unit: string | undefined;
        const varsLower = variables.map(lower);
        for (const v of pool) {
          const name = lower(v.variable || v.name || "");
          unit = v.unit;
          const ok = varsLower.some(w => name.includes(w)) || (name.includes('pv') && name.includes('power')) || name==='ppv' || name==='ppvtotal';
          if (!ok) continue;
          const candidates = [v.value, v.val, v.power, v.p, Array.isArray(v.values) ? v.values.slice(-1)[0]?.value : undefined];
          for (const c of candidates) {
            const w = kwToW(c, unit);
            if (w !== null) { val = w; matched = v.variable || v.name || null; break; }
          }
          if (val !== null) break;
        }
        return { raw, pvNowW: val, matchedVar: matched };
      }
      if (json?.errno === 40256) continue;
    } catch {}
  }
  return { raw: null, pvNowW: null, matchedVar: null };
}

export async function foxDevices(){
  const path = "/op/v0/device/list";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  for (const kind of kinds) {
    const sign = buildSignature(path, token, ts, kind);
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": process.env.FOXESS_API_LANG || "pl",
      "timestamp": String(ts),
      "token": token,
      "sign": sign,
      "signature": sign
    };
    const url = FOX_DOMAIN + path;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ currentPage: 1, pageSize: 50 }), cache: "no-store" });
    const txt = await res.text();
    try { const j = JSON.parse(txt); if (j?.errno === 0) return j.result; } catch {}
  }
  return [];
}

export async function foxHistoryDay({ sn, date, variables }:{ sn:string; date:string; variables: string[] }){
  const path = "/op/v0/device/history/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  const d0 = date + " 00:00:00";
  const d1 = date + " 23:59:59";

  const bodies: any[] = [
    { sn, variables, dimension: "HOUR", beginDate: d0, endDate: d1 },
    { sn, variables, type: "HOUR", beginDate: d0, endDate: d1 },
    { sn, variables, dimension: "HOUR", startDate: d0, endDate: d1 },
    { sn, variables, type: "HOUR", startDate: d0, endDate: d1 },
    { sn, variables, dimension: "day", beginDate: d0, endDate: d1 },
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
    const url = FOX_DOMAIN + path;
    for (const body of bodies) {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json?.errno === 0 && Array.isArray(json.result)) {
          return json.result as Array<{ variable: string; unit: string; values: number[] }>;
        }
      } catch {}
    }
  }
  return [];
}

export default {};
