import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

type SepKind = "literal" | "crlf" | "lf";
export type FoxReportDim = "day" | "month" | "year";

function buildSignature(path: string, token: string, ts: number, kind: SepKind){
  const SEPS: Record<SepKind, string> = {
    literal: "\\r\\n",
    crlf: "\r\n",
    lf: "\n",
  };
  const sep = SEPS[kind];
  const plain = path + sep + token + sep + String(ts);
  return crypto.createHash("md5").update(plain).digest("hex");
}

async function callFox(path: string, headers: Record<string,string>, body: any){
  const res = await fetch("https://www.foxesscloud.com"+path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { res, text, json };
}

function normalizeValues(values: any, unit?: string){
  const arr = Array.isArray(values) ? values.map((x:any)=> Number(x)||0) : [];
  const maxv = arr.length ? Math.max(...arr) : 0;
  let out = arr.slice();
  let u = String(unit || "kWh");
  if (u.toLowerCase() === "kwh" && maxv > 20000){
    out = out.map((v)=> v/1000);
    u = "kWh";
  }
  const fit24 = new Array(24).fill(0);
  for (let i=0;i<Math.min(24,out.length);i++){
    fit24[i] = +Number(out[i]).toFixed(3);
  }
  return { unit: u, values: fit24 };
}

function parseReportResult(raw:any){
  const out: Array<{ variable: string; unit: string; values: number[] }> = [];
  const push = (label:any, unit:any, values:any)=>{
    const vname = String(label||"").trim() || String(unit||"").trim() || "unknown";
    const norm = normalizeValues(values, unit);
    out.push({ variable: vname, unit: norm.unit, values: norm.values });
  };

  if (Array.isArray(raw)){
    if (raw.length && (Array.isArray(raw[0]?.values) || raw[0]?.values == null)){
      for (const r of raw) push((r as any).variable ?? (r as any).name, (r as any).unit, (r as any).values);
    } else if (raw.length && Array.isArray((raw[0] as any)?.datas)){
      for (const blk of raw as any[]) for (const ds of (blk?.datas || [])){
        const vals = ds?.values ?? ds?.data ?? ds?.points;
        push(ds.variable ?? ds.name, ds.unit, vals);
      }
    } else {
      for (const r of raw as any[]){
        const keys = Object.keys(r||{});
        for (const k of keys){
          if (k === "unit" || k === "variable" || k === "name") continue;
          const vals = (r as any)[k];
          if (Array.isArray(vals)) push(k, (r as any).unit, vals);
        }
      }
    }
  } else if (raw && typeof raw === "object"){
    for (const [k,v] of Object.entries(raw)){
      if (Array.isArray(v)) push(k, (raw as any).unit, v);
    }
  }
  return out;
}

/** Realtime (pvPower / generationPower -> W) */
export async function foxRealtimeQuery({ sn, variables }:{ sn:string; variables: string[] }){
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const PATH = "/op/v0/device/real/query";
  const ts = Date.now();
  const kinds: SepKind[] = ["crlf","literal","lf"];

  const pickDatas = (result:any): any[] => {
    if (!result) return [];
    if (Array.isArray(result?.datas)) return result.datas;
    if (Array.isArray(result) && result.length && Array.isArray(result[0]?.datas)) return result[0].datas;
    if (Array.isArray(result?.result?.datas)) return result.result.datas;
    if (Array.isArray(result?.inverter?.datas)) return result.inverter.datas;
    return [];
  };

  for (const kind of kinds){
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "token": token,
      "timestamp": String(ts),
      "signature": buildSignature(PATH, token, ts, kind),
      "lang": process.env.FOXESS_API_LANG || "pl"
    };
    const { json } = await callFox(PATH, headers, { sn, variables });
    if (json && json.errno === 0){
      const datas = pickDatas(json.result);
      const pref = ["pvPower","pv1Power","pv2Power","pvPowerW","generationPower","inverterPower","outputPower","ppv","ppvTotal","gridExportPower","feedinPower","acPower"];
      for (const p of pref){
        const ds = datas.find((d:any)=> String(d?.variable||"").toLowerCase()===p.toLowerCase() || String(d?.name||"").toLowerCase()===p.toLowerCase());
        if (ds && typeof ds.value === "number"){
          const unit = String(ds.unit||"").toLowerCase();
          const w = unit.includes("kw") ? Math.round(Number(ds.value)*1000) : Math.round(Number(ds.value));
          return { ok:true, matched: ds.variable || ds.name || p, pvNowW: w, raw: [json.result] };
        }
      }
      return { ok:true, matched: null, pvNowW: null, raw: [json.result] };
    }
  }
  return { ok:false, error:"FoxESS realtime failed" };
}

/** Raport dzienny (bezpośrednio do 'day') */
export async function foxReportQueryDay({ sn, year, month, day, variables = ["generation","feedin"], lang = "pl" }:{
  sn:string; year:number; month:number; day:number; variables?: string[]; lang?: string;
}){
  return await foxReportQuery({ sn, year, month, day, dimension: "day", variables, lang });
}

/** Raport generyczny (day/month/year) — eksponowany jako 'foxReportQuery' żeby nie ruszać reszty kodu */
export async function foxReportQuery({
  sn, year, month, day, dimension, variables = ["generation","feedin"], lang = "pl"
}:{
  sn:string; year:number; month?:number; day?:number; dimension: FoxReportDim; variables?: string[]; lang?: string;
}){
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const PATH = "/op/v0/device/report/query";
  const ts = Date.now();
  const kinds: SepKind[] = ["crlf", "literal", "lf"];
  const keys: Array<"dimension"|"type"> = ["dimension","type"];
  let lastErr = "";

  for (const key of keys){
    for (const kind of kinds){
      const headers: Record<string,string> = {
        "Content-Type": "application/json",
        "token": token,
        "timestamp": String(ts),
        "signature": buildSignature(PATH, token, ts, kind),
        "lang": lang
      };
      const body:any = { sn, year, variables };
      if (typeof month === "number") body.month = month;
      if (typeof day === "number") body.day = day;
      (body as any)[key] = dimension;

      const { res, json, text } = await callFox(PATH, headers, body);
      if (!json || typeof json.errno !== "number"){
        lastErr = `HTTP ${res?.status}: ${text}`;
        continue;
      }
      if (json.errno !== 0){
        lastErr = `${json.errno}: ${json.msg || "error"}`;
        continue;
      }
      return parseReportResult(json.result);
    }
  }
  throw new Error("FoxESS report failed: " + lastErr);
}

/** Lista urządzeń (na potrzeby debug route) */
export async function foxDevices(){
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const PATH = "/op/v0/device/list";
  const ts = Date.now();
  const kinds: SepKind[] = ["crlf","literal","lf"];
  for (const kind of kinds){
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "token": token,
      "timestamp": String(ts),
      "signature": buildSignature(PATH, token, ts, kind),
      "lang": process.env.FOXESS_API_LANG || "pl"
    };
    const { json, text, res } = await callFox(PATH, headers, { currentPage: 1, pageSize: 50 });
    if (json && json.errno === 0) return { ok:true, ...json.result };
    if (!res?.ok) return { ok:false, error: text };
  }
  return { ok:false, error:"device list error" };
}

/** Ping/diagnostyka podpisu */
export async function foxPing(){
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const PATH = "/op/v0/device/list";
  const ts = Date.now();
  const kinds: SepKind[] = ["crlf","literal","lf"];
  const results:any = {};
  for (const kind of kinds){
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "token": token,
      "timestamp": String(ts),
      "signature": buildSignature(PATH, token, ts, kind),
      "lang": "pl"
    };
    const { res, text } = await callFox(PATH, headers, { currentPage:1, pageSize:1 });
    results[kind] = { status: res.status, text };
  }
  return results;
}
