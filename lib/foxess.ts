import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";

// --- Signatures ---
function md5Signature(path: string, token: string, timestamp: number) {
  // legacy OpenAPI: md5(path + "\r\n" + token + "\r\n" + timestamp)
  const plaintext = path + "\r\n" + token + "\r\n" + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
}

function hmacSignature(appId: string, appSecret: string, bodyObj: any, algo: "sha1"|"sha256" = "sha1") {
  // new API: HMAC(appSecret) over appId + timestamp + JSON.stringify(body)
  const timestamp = Date.now().toString();
  const bodyStr = JSON.stringify(bodyObj || {});
  const raw = appId + timestamp + bodyStr;
  const sig = crypto.createHmac(algo, appSecret).update(raw).digest("hex");
  return { timestamp, signature: sig, rawBody: bodyStr };
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
  const url = FOX_DOMAIN + path;

  const body: any = { sn, year, dimension, variables };
  if (month) body.month = month;
  if (day) body.day = day;

  // Prefer HMAC appId/appSecret when provided, fallback to legacy md5 token
  const appId = process.env.FOXESS_APP_ID || "";
  const appSecret = process.env.FOXESS_APP_SECRET || "";
  const token = process.env.FOXESS_API_KEY || ""; // legacy
  const langHdr = lang;

  const headers: Record<string,string> = {
    "Content-Type": "application/json",
    "lang": langHdr,
  };

  let fetchBody = JSON.stringify(body);

  if (appId && appSecret) {
    const { timestamp, signature, rawBody } = hmacSignature(appId, appSecret, body, "sha1");
    headers["appId"] = appId;
    headers["timestamp"] = timestamp;
    // nie wiemy czy header nazywa sie "signature" czy "sign" — dodajmy oba
    headers["signature"] = signature;
    headers["sign"] = signature;
    fetchBody = rawBody;
  } else if (token) {
    const ts = Date.now();
    const signature = md5Signature(path, token, ts);
    headers["timestamp"] = String(ts);
    headers["signature"] = signature;
    headers["token"] = token;
  } else {
    throw new Error("Brak konfiguracji FOXESS (ustaw FOXESS_APP_ID/FOXESS_APP_SECRET lub FOXESS_API_KEY).");
  }

  const res = await fetch(url, { method: "POST", headers, body: fetchBody, cache: "no-store" });
  if (!res.ok) throw new Error(`FoxESS ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errno !== 0) throw new Error(`FoxESS API error ${json.errno}: ${json.msg || ""}`);
  return json.result as Array<{ variable: string; unit: string; values: number[] }>;
}

// Simple ping (for debugging signing/time)
export async function foxPing() {
  const path = "/op/v0/ping"; // if unsupported, will still verify signature layer
  const url = FOX_DOMAIN + path;
  const appId = process.env.FOXESS_APP_ID || "";
  const appSecret = process.env.FOXESS_APP_SECRET || "";
  const token = process.env.FOXESS_API_KEY || "";
  const headers: Record<string,string> = {
    "Content-Type": "application/json",
    "lang": process.env.FOXESS_API_LANG || "pl",
  };
  let body = "{}";
  if (appId && appSecret) {
    const { timestamp, signature, rawBody } = ((): any => {
      const t = Date.now().toString();
      const raw = appId + t + "{}";
      const sig = crypto.createHmac("sha1", appSecret).update(raw).digest("hex");
      return { timestamp: t, signature: sig, rawBody: "{}" };
    })();
    headers["appId"] = appId;
    headers["timestamp"] = body.timestamp || Date.now().toString();
    headers["signature"] = body.signature || "";
    body = rawBody || "{}";
  } else if (token) {
    const ts = Date.now();
    headers["timestamp"] = String(ts);
    headers["signature"] = crypto.createHash("md5").update(path + "\r\n" + token + "\r\n" + String(ts)).digest("hex");
    headers["token"] = token;
  }
  const res = await fetch(url, { method: "POST", headers, body });
  return { ok: res.ok, status: res.status, text: await res.text() };
}
