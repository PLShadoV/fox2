import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";

export function foxSignature(path: string, token: string, timestamp: number) {
  const plaintext = path + "\r\n" + token + "\r\n" + String(timestamp);
  return crypto.createHash("md5").update(plaintext).digest("hex");
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
  const token = process.env.FOXESS_API_KEY || "";
  const ts = Date.now();
  const signature = foxSignature(path, token, ts);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "lang": lang,
    "timestamp": String(ts),
    "signature": signature,
  };
  if (token) headers["token"] = token;
  if (process.env.FOXESS_OAUTH_BEARER) headers["Authorization"] = process.env.FOXESS_OAUTH_BEARER!;

  const body: any = { sn, year, dimension, variables };
  if (month) body.month = month;
  if (day) body.day = day;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) throw new Error(`FoxESS ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errno !== 0) throw new Error(`FoxESS API error ${json.errno}: ${json.msg || ""}`);
  return json.result as Array<{ variable: string; unit: string; values: number[] }>;
}
