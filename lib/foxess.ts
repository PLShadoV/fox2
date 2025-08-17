import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";
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

function normalizeValues(values: any, unit?: string){
  const arr = Array.isArray(values) ? values.map((x:any)=> Number(x)||0) : [];
  const maxv = arr.length ? Math.max(...arr) : 0;
  // FoxESS czasem zwraca "kwh" ale liczby wyglądają jak Wh (rzędu 1e6) ⇒ dzielimy przez 1000
  let out = arr.slice();
  let u = String(unit || "kWh");
  if (u.toLowerCase() === "kwh" && maxv > 20000) { // próg podniesiony, by pewniej wykryć Wh
    out = out.map((v)=> v/1000);
    u = "kWh";
  }
  const fit24 = new Array(24).fill(0);
  for (let i=0;i<Math.min(24,out.length);i++) fit24[i] = +Number(out[i]).toFixed(3);
  return { unit: u, values: fit24 };
}

export async function foxReportQuery({
  sn, year, month, day, dimension, variables, lang = process.env.FOXESS_API_LANG || "pl",
}:{
  sn: string; year: number; month?: number; day?: number;
  dimension: FoxReportDim; variables: string[]; lang?: string;
}) {
  const path = "/op/v0/device/report/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY (token MD5).");

  const ts = Date.now();
  const body: any = { sn, year, dimension, variables };
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
      if (json.errno === 0) {
        const raw = json.result;

        // --- Parser uniwersalny na kilka kształtów odpowiedzi ---
        const out: Array<{ variable: string; unit: string; values: number[] }> = [];

        const pushEntry = (label: any, unit: any, values: any) => {
          const vname = String(label || "").trim() || String(unit || "").trim() || "unknown";
          const norm = normalizeValues(values, unit);
          out.push({ variable: vname, unit: norm.unit, values: norm.values });
        };

        if (Array.isArray(raw)) {
          // wariant 1: [{ variable, unit, values }, ...]
          if (raw.length && (Array.isArray(raw[0]?.values) || raw[0]?.values == null)) {
            for (const r of raw) pushEntry((r as any).variable ?? (r as any).name, (r as any).unit, (r as any).values);
          }
          // wariant 2: [{ datas: [{ name/variable, unit, values }, ...]}, ...]
          else if (raw.length && Array.isArray((raw[0] as any)?.datas)) {
            for (const blk of raw as any[]) {
              for (const ds of (blk?.datas || [])) {
                pushEntry(ds.variable ?? ds.name, ds.unit, ds.values ?? ds.data ?? ds.points);
              }
            }
          }
          // wariant 3: [{ [var]: values, unit? }, ...]
          else {
            for (const r of raw as any[]) {
              const keys = Object.keys(r||{});
              for (const k of keys) {
                if (k === "unit" || k === "name" || k === "variable") continue;
                const vals = (r as any)[k];
                if (Array.isArray(vals)) pushEntry(k, (r as any).unit, vals);
              }
            }
          }
        } else if (raw && typeof raw === "object") {
          // wariant 4: { variable1: [..], variable2: [..], unit? }
          for (const [k, v] of Object.entries(raw)) {
            if (Array.isArray(v)) pushEntry(k, (raw as any).unit, v);
          }
        }

        if (out.length) return out;
        // gdy parser nic nie wyłuskał:
        return [];
      }
      if (json.errno === 40256) { lastErr = `FoxESS API error 40256 (signature/timestamp)`; continue; }
      if (json.errno === 40257) { lastErr = `FoxESS API error 40257: Parametr nie spełnia oczekiwań`; break; }
      lastErr = `FoxESS API error ${json.errno}: ${json.msg || ""}`; break;
    } else { lastErr = `FoxESS: unexpected response: ${text}`; break; }
  }
  throw new Error(lastErr || "FoxESS: unknown error");
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
