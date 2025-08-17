import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    const token = process.env.FOXESS_API_KEY || "";
    if (!sn || !token) return NextResponse.json({ ok:false, error:"Brak FOXESS_INVERTER_SN lub FOXESS_API_KEY" });
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const [y,m,d] = date.split("-").map(Number);

    const path = "/op/v0/device/report/query";
    const ts = Date.now();

    const seps = { literal: "\\r\\n", crlf: "\r\n", lf: "\n" } as const;
    const tryKinds = ["literal","crlf","lf"] as const;

    const body = { sn, year: y, month: m, day: d, dimension: "day", variables: ["generation","yield","eDay","dayEnergy","feedin","gridExportEnergy","export","gridOutEnergy","sell","toGrid","eOut"] };

    for (const k of tryKinds) {
      const plaintext = path + seps[k] + token + seps[k] + String(ts);
      const sign = (await import("crypto")).createHash("md5").update(plaintext).digest("hex");
      const headers: Record<string,string> = {
        "Content-Type": "application/json",
        "lang": process.env.FOXESS_API_LANG || "pl",
        "timestamp": String(ts),
        "token": token,
        "sign": sign,
        "signature": sign
      };
      const resp = await fetch("https://www.foxesscloud.com"+path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
      const text = await resp.text();
      return new NextResponse(text, { status: 200, headers: { "content-type": resp.headers.get("content-type") || "application/json" } });
    }
    return NextResponse.json({ ok:false, error:"Nie udało się pozyskać" }, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
