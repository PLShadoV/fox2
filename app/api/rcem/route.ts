import { NextRequest, NextResponse } from "next/server";

const MONTHS_PL = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
const MONTHS_NORM = ["styczen","luty","marzec","kwiecien","maj","czerwiec","lipiec","sierpien","wrzesien","pazdziernik","listopad","grudzien"];

function norm(txt:string){
  return txt.toLowerCase()
    .replaceAll("&nbsp;"," ")
    .replaceAll("\u00a0"," ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type Item = { monthIndex:number; monthLabel:string; year:number; value:number|null; ym?:string };

function parseRCEm(html:string){
  const plain = norm(html);
  // Find table rows with year, month name and numeric value
  const rows = Array.from(plain.matchAll(/(\d{4}).{0,20}?(styczen|luty|marzec|kwiecien|maj|czerwiec|lipiec|sierpien|wrzesien|pazdziernik|listopad|grudzien).*?(\d+[\.,]\d+)/g));
  const items: Item[] = [];
  for (const m of rows){
    const year = Number(m[1]);
    const monthNorm = m[2];
    const value = Number(String(m[3]).replace(",", "."));
    const monthIndex = Math.max(0, MONTHS_NORM.indexOf(monthNorm));
    const monthLabel = MONTHS_PL[monthIndex] || monthNorm;
    items.push({ year, monthIndex, monthLabel, value, ym: `${year}-${String(monthIndex+1).padStart(2,"0")}` });
  }
  // De-duplicate by ym (first occurrence is newest on PSE page usually)
  const seen = new Set<string>();
  const unique: Item[] = [];
  for (const it of items){
    if (it.ym && !seen.has(it.ym)){ seen.add(it.ym); unique.push(it); }
  }
  return unique;
}

export async function GET(req: NextRequest){
  try{
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || undefined;
    const res = await fetch("https://www.pse.pl/oire/rcem-rynkowa-miesieczna-cena-energii-elektrycznej", { next: { revalidate: 21600 } });
    if (!res.ok) return NextResponse.json({ ok:false, source:"pse", status:res.status }, { status:200 });
    const html = await res.text();
    const items = parseRCEm(html);

    // Compute rcem for a given YYYY-MM-DD (or today) if requested
    const target = dateParam ? new Date(dateParam+"T00:00:00") : new Date();
    const ym = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,"0")}`;
    const monthItem = items.find(it => it.ym === ym) || null;
    const rcem_pln_mwh = monthItem?.value ?? null;

    return NextResponse.json({ ok:true, source:"pse", ym, rcem_pln_mwh, current_month_rcem_pln_mwh: rcem_pln_mwh, items });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:200 });
  }
}
