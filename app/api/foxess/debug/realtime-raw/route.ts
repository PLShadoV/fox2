import { NextRequest, NextResponse } from "next/server";

export async function GET(){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    const token = process.env.FOXESS_API_KEY || "";
    if (!sn || !token) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN lub FOXESS_API_KEY" });
    const path = "/op/v0/device/real/query";
    const ts = Date.now();
    const seps = { literal: "\\r\\n", crlf: "\r\n", lf: "\n" } as const;
    for (const k of ["literal","crlf","lf"] as const){
      const signPlain = path + seps[k] + token + seps[k] + String(ts);
      const sign = (await import("crypto")).createHash("md5").update(signPlain).digest("hex");
      const headers: Record<string,string> = {
        "Content-Type": "application/json",
        "lang": process.env.FOXESS_API_LANG || "pl",
        "timestamp": String(ts),
        "token": token,
        "sign": sign,
        "signature": sign
      };
      const res = await fetch("https://www.foxesscloud.com"+path, { method:"POST", headers, body: JSON.stringify({ sn, variables: ["pvPower","pv1Power","pv2Power","generationPower","feedinPower"] }), cache: "no-store" });
      const text = await res.text();
      return new NextResponse(text, { status: 200, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
    }
    return NextResponse.json({ ok:false, error:"Nie udało się pobrać" });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
