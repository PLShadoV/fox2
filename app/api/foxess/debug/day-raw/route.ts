import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const PATH = "/op/v0/device/report/query";

function signCRLF(token: string, ts:number){
  const plain = `${PATH}\r\n${token}\r\n${ts}`;
  return crypto.createHash("md5").update(plain).digest("hex");
}
function signLiteral(token: string, ts:number){
  const plain = PATH + "\\r\\n" + token + "\\r\\n" + String(ts);
  return crypto.createHash("md5").update(plain).digest("hex");
}

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    const token = process.env.FOXESS_API_KEY || "";
    if (!sn || !token) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN lub FOXESS_API_KEY" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const [y,m,d] = date.split("-").map(Number);
    const ts = Date.now();

    const body = { sn, year: y, month: m, day: d, dimension: "day", variables: ["generation","feedin"] };

    // najpierw prawdziwe CRLF
    let res = await fetch("https://www.foxesscloud.com"+PATH, {
      method:"POST",
      headers: {
        "Content-Type": "application/json",
        "token": token,
        "timestamp": String(ts),
        "signature": signCRLF(token, ts),
        "lang": "pl"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let text = await res.text();
    // fallback: literal \r\n jeśli 40256
    if (res.ok){
      try {
        const j = JSON.parse(text);
        if (j?.errno === 40256){
          res = await fetch("https://www.foxesscloud.com"+PATH, {
            method:"POST",
            headers: {
              "Content-Type": "application/json",
              "token": token,
              "timestamp": String(ts),
              "signature": signLiteral(token, ts),
              "lang": "pl"
            },
            body: JSON.stringify(body),
            cache: "no-store"
          });
          text = await res.text();
        }
      } catch {}
    }

    return new NextResponse(text, { status: 200, headers: { "content-type": res.headers.get("content-type") || "application/json" }});
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
