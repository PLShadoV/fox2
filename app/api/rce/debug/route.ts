import { NextRequest, NextResponse } from "next/server";

const PSE_API_BASE = process.env.PSE_API_BASE || "https://api.raporty.pse.pl/api";

export async function GET(req: NextRequest){
  try {
    const urlIn = new URL(req.url);
    const date = urlIn.searchParams.get("date") || new Date().toISOString().slice(0,10);
    const url = new URL(PSE_API_BASE + "/rce-pln");
    url.searchParams.set("$filter", `business_date eq '${date}'`);
    url.searchParams.set("$orderby", "dtime asc");
    url.searchParams.set("$top", "100");
    const res = await fetch(url.toString(), { cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, { status: 200, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 200 });
  }
}
