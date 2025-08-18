import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cache = { ts: number; value: any };
const TTL = 60 * 1000; // 60s
let last: Cache | null = null;

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

export async function GET(req: NextRequest){
  const now = Date.now();
  if (last && (now - last.ts) < TTL) return NextResponse.json(last.value);
  const origin = new URL(req.url).origin;
  const data = await j(`${origin}/api/foxess/realtime`);
  last = { ts: now, value: data };
  return NextResponse.json(data);
}
