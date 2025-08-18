import crypto from "crypto";

const FOX_DOMAIN = process.env.FOXESS_API_BASE || "https://www.foxesscloud.com";

type SepKind = "literal" | "crlf" | "lf";

function signFor(path: string, token: string, ts: number, kind: SepKind) {
  const sep = kind === "literal" ? "\r\n" : (kind === "crlf" ? "\r\n".replace(/\\/g, "") : "\n".replace(/\\/g, ""));
  const raw = path + sep + token + sep + String(ts);
  return crypto.createHash("md5").update(raw).digest("hex");
}

// Low-level FoxESS POST that tries 3 separator variants for signature
async function foxPost(path: string, body: any) {
  const appId = process.env.FOXESS_APP_ID || "";
  const token = process.env.FOXESS_TOKEN || "";
  if (!appId || !token) throw new Error("Missing FOXESS_APP_ID or FOXESS_TOKEN");

  const url = FOX_DOMAIN + path;
  const ts = Date.now();
  const tryKinds: SepKind[] = ["literal","crlf","lf"];
  let lastErr: any = null;
  for (const k of tryKinds) {
    const sign = signFor(path, token, ts, k);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "AppId": appId,
        "Signature": sign,
        "Timestamp": String(ts),
        "Token": token,
      },
      body: JSON.stringify(body),
      // avoid Next.js auto cache
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    // FoxESS returns errno=0 on success
    if (json && typeof json.errno !== "undefined") {
      if (json.errno === 0) return json;
      lastErr = new Error(`FoxESS errno ${json.errno}: ${json.msg || "unknown"}`);
      // 40256/40257 typical -> try next sep
      continue;
    }
    // If unexpected, keep trying the next variant
    lastErr = new Error("FoxESS unexpected response");
  }
  throw lastErr || new Error("FoxESS request failed");
}

// Public: fetch 5-min history of generationPower for a given day.
export async function foxPowerDay(dateISO: string) {
  const sn = process.env.FOXESS_DEVICE_SN || "";
  if (!sn) throw new Error("Missing FOXESS_DEVICE_SN");

  // 00:00 -> next day 00:00 local
  const d = new Date(dateISO + "T00:00:00");
  const end = new Date(d); end.setDate(end.getDate() + 1);

  const fmt = (x: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
  };

  const body = {
    deviceSN: sn,
    variables: ["generationPower"],
    startTime: fmt(d),
    endTime: fmt(end),
    timeStep: 300, // 5 min
  };

  // Most deployments work with this path:
  const path = "/c/v0/device/history";
  const json = await foxPost(path, body);
  // Normalize different possible shapes
  // Expected: { errno:0, result:{ datas:[{ variable:"generationPower", values:[...], unit:"kW"}], time: ["..."] } }
  const datas = json?.result?.datas || json?.result || json?.datas || [];
  const series = Array.isArray(datas) ? datas.find((x:any)=>/generationpower/i.test(x?.variable || "")) : null;
  const values = series?.values || [];
  const times = json?.result?.time || json?.time || [];

  // Map to points {t:number, kw:number}
  const points = values.map((v:number, i:number) => {
    const ts = times?.[i] || null;
    const t = ts ? Date.parse(ts.replace(" ", "T") + "Z") : NaN;
    const kw = (typeof v === "number") ? v : Number(v);
    return { t, kw: isFinite(kw) ? kw : 0 };
  }).filter((p:any)=> isFinite(p.t));

  return { unit: series?.unit || "kW", points };
}
