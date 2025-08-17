import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";

type SepKind = "literal" | "crlf" | "lf";

function buildSignature(path: string, token: string, timestamp: number, kind: SepKind) {
  const sep = kind === "literal" ? "\\r\\n" : (kind === "crlf" ? "\r\n" : "\n");
  const plaintext = path + sep + token + sep + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
}

async function callFox(path: string, headers: Record<string,string>, bodyObj: any) {
  const url = FOX_DOMAIN + path;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyObj), cache: "no-store" });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { res, text, json };
}

export async function foxReportQuery({
  sn,
  year,
  month,
  day,
  dimension,
  variables,
  lang = process.env.FOXESS_API_LANG || "pl",
}: {
  sn: string; year: number; month?: number; day?: number;
  dimension: FoxReportDim; variables: string[]; lang?: string;
}) {
  const path = "/op/v0/device/report/query";
  const token = process.env.FOXESS_API_KEY || "";
  if (!token) throw new Error("Brak FOXESS_API_KEY (używamy trybu token/MD5).");

  const ts = Date.now(); // ms
  const body: any = { sn, year, dimension, variables };
  if (month) body.month = month;
  if (day) body.day = day;

  // prefer 'literal' ("\\r\\n") first — zgodnie z Twoją obserwacją
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

    if (!res.ok) {
      lastErr = `FoxESS ${res.status}: ${text}`;
      // nie próbuj innych wariantów, bo to raczej nie kwestia podpisu
      break;
    }
    if (json && typeof json.errno === "number") {
      if (json.errno === 0) {
        return json.result as Array<{ variable: string; unit: string; values: number[] }>;
      }
      if (json.errno === 40256) {
        // spróbuj kolejnym separatorem
        lastErr = `FoxESS API error 40256 (separator=${kind})`;
        continue;
      }
      lastErr = `FoxESS API error ${json.errno}: ${json.msg || ""}`;
      break;
    } else {
      lastErr = `FoxESS: unexpected response: ${text}`;
      break;
    }
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
    const url = "https://www.foxesscloud.com" + path;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ currentPage: 1, pageSize: 1 }), cache: "no-store" });
    out[kind] = { ok: res.ok, status: res.status, text: await res.text() };
  }
  return out;
}
