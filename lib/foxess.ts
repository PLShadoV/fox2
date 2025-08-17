import crypto from "crypto";

const FOX_DOMAIN = "https://www.foxesscloud.com";

export type FoxReportDim = "day" | "month" | "year";

function md5Signature(path: string, token: string, timestamp: number, useLF: boolean) {
  const sep = useLF ? "\n" : "\r\n";
  const plaintext = path + sep + token + sep + String(timestamp);
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
  if (!token) throw new Error("Brak FOXESS_API_KEY (używamy trybu token/MD5).");

  const ts = Date.now(); // ms
  // prefer LF; generate both
  const signLF = md5Signature(path, token, ts, true);
  const signCRLF = md5Signature(path, token, ts, false);

  const headers: Record<string,string> = {
    "Content-Type": "application/json",
    "lang": lang,
    "language": lang,
    "timestamp": String(ts),
    "token": token,
    "sign": signLF,        // najczęściej używany nagłówek
    "signature": signLF,   // mirror; jeśli backend patrzy na 'signature'
    "x-sign-crlf": signCRLF // diagnostyka (ignorowane przez FoxESS)
  };

  const body: any = { sn, year, dimension, variables };
  if (month) body.month = month;
  if (day) body.day = day;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) throw new Error(`FoxESS ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errno !== 0) {
    // bardziej czytelny komunikat
    if (json.errno === 40256) {
      throw new Error("FoxESS API error 40256: illegal signature/timestamp — sprawdź FOXESS_API_KEY i generowanie 'sign' (LF), oraz czy timestamp jest w milisekundach.");
    }
    throw new Error(`FoxESS API error ${json.errno}: ${json.msg || ""}`);
  }
  return json.result as Array<{ variable: string; unit: string; values: number[] }>;
}
