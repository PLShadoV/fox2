import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Cache = { ts: number; value: any };
const TTL = 60 * 1000; // 60s
const mem: Record<string, Cache> = {};

async function j(url:string){
  const r = await fetch(url, { cache: "no-store" as any });
  if (!r.ok) throw new Error(url + " -> " + r.status);
  return r.json();
}

export async function GET(req: NextRequest){
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0,10);
  const key = `sum:${date}`;
  const now = Date.now();
  const hit = mem[key];
  if (hit && (now - hit.ts) < TTL) return NextResponse.json(hit.value);

  const origin = url.origin;
  const data = await j(`${origin}/api/foxess/summary/day?date=${date}`);
  mem[key] = { ts: now, value: data };
  return NextResponse.json(data);
}
