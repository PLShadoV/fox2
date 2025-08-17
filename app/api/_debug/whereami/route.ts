import { NextResponse } from "next/server";

export async function GET(req: Request){
  try{
    const url = new URL(req.url);
    const hdrs = {
      host: (req as any).headers.get("host"),
      proto: (req as any).headers.get("x-forwarded-proto"),
      forwardedHost: (req as any).headers.get("x-forwarded-host"),
      vercelUrl: process.env.VERCEL_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL,
    };
    return NextResponse.json({ ok:true, url: url.href, headers: hdrs });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e.message });
  }
}
