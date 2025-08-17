import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

type SepKind = "literal" | "crlf" | "lf";

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

// Drop-in replacement for your existing foxRealtimeQuery with robust shape handling
export async function foxRealtimeQuery({ sn, variables }:{ sn: string; variables: string[] }){
  const path = "/op/v0/device/real/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY");
  const ts = Date.now();
  const kinds: SepKind[] = ["literal", "crlf", "lf"];
  let lastErr: string | null = null;

  const pickDatas = (result:any): any[] => {
    if (!result) return [];
    // common: { datas: [...] }
    if (Array.isArray(result?.datas)) return result.datas;
    // observed: [ { datas: [...] } ]
    if (Array.isArray(result) && result.length && Array.isArray(result[0]?.datas)) return result[0].datas;
    // rare: { result: { datas: [...] } }
    if (Array.isArray(result?.result?.datas)) return result.result.datas;
    // some devices: { inverter: { datas: [...] } }
    if (Array.isArray(result?.inverter?.datas)) return result.inverter.datas;
    return [];
  };

  for (const kind of kinds) {
    const headers: Record<string,string> = {
      "Content-Type": "application/json",
      "lang": process.env.FOXESS_API_LANG || "pl",
      "timestamp": String(ts),
      "token": token,
      "sign": buildSignature(path, token, ts, kind),
      "signature": buildSignature(path, token, ts, kind)
    };
    const body = { sn, variables };
    const { json, text } = await callFox(path, headers, body);
    if (!json) { lastErr = text; continue; }
    if (json.errno === 0) {
      const result = json.result;
      const datas = pickDatas(result);
      const tried = variables.slice();
      const pref = ["pvPower","pv1Power","pv2Power","pvPowerW","generationPower","inverterPower","outputPower","ppv","ppvTotal","gridExportPower","feedinPower","acPower"];
      let matched: string | null = null;
      let pvNowW: number | null = null;
      for (const p of pref){
        const ds = datas.find((d:any)=> String(d?.variable||"").toLowerCase() === p.toLowerCase() || String(d?.name||"").toLowerCase() === p.toLowerCase());
        if (ds && typeof ds.value === "number") {
          const unit = String(ds.unit || "").toLowerCase();
          const k = Number(ds.value);
          pvNowW = unit.includes("kw") ? Math.round(k*1000) : Math.round(k);
          matched = String(ds.variable || ds.name || p);
          break;
        }
      }
      return { ok:true, tried, matched, pvNowW, raw: [result] };
    }
    lastErr = `FoxESS API error ${json.errno}: ${json.msg || ""}`;
  }
  return { ok:false, error: lastErr || "FoxESS realtime error" };
}
