import { NextResponse } from "next/server";

const MONTHS_PL = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
const MONTHS_NORM = ["styczen","luty","marzec","kwiecien","maj","czerwiec","lipiec","sierpien","wrzesien","pazdziernik","listopad","grudzien"];

function norm(txt:string){
  return txt.toLowerCase()
    .replaceAll("&nbsp;"," ")
    .replaceAll("\u00a0"," ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type Item = { monthIndex:number; monthLabel:string; year:number; value:number|null };

function parseRCEm(html:string){
  const plain = norm(html);
  const items: Item[] = [];

  for (let mi=0; mi<MONTHS_NORM.length; mi++){
    const m = MONTHS_NORM[mi];
    const re = new RegExp(`\\b${m}\\b`, "g");
    let match;
    while ((match = re.exec(plain))){
      const idx = match.index;

      // find year near the month (search backwards then forwards)
      const back = plain.slice(Math.max(0, idx-1200), idx);
      const fwd  = plain.slice(idx, idx+1200);
      const yearBack = back.match(/20\d{2}/g)?.pop();
      const yearFwd  = fwd.match(/20\d{2}/g)?.[0];
      const year = yearBack ? Number(yearBack) : (yearFwd ? Number(yearFwd) : new Date().getFullYear());

      // find number after "rcem"
      const rcemBlock = fwd.slice(0, 260);
      const numMatch = rcemBlock.match(/rcem[^0-9]*?(\d{1,4}(?:[.,]\d{2}))/);
      const value = numMatch ? Number(numMatch[1].replace(",", ".")) : null;

      // push
      const label = MONTHS_PL[mi];
      items.push({ monthIndex: mi, monthLabel: label, year, value });
    }
  }

  // de-duplicate by year+monthIndex and keep the first with a number
  const map = new Map<string, Item>();
  for (const it of items){
    const key = `${it.year}-${it.monthIndex}`;
    if (!map.has(key) || (it.value!=null && map.get(key)!.value==null)){
      map.set(key, it);
    }
  }
  const out = Array.from(map.values());

  // filter out future months (no showing next month ahead)
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth(); // 0..11
  const filtered = out.filter(it => (it.year < curY) || (it.year === curY && it.monthIndex <= curM));

  // sort DESC by year, month
  filtered.sort((a,b)=> b.year - a.year || b.monthIndex - a.monthIndex);

  // last 18 entries max
  return filtered.slice(0, 18);
}

export async function GET(){
  try{
    const res = await fetch("https://www.pse.pl/oire/rcem-rynkowa-miesieczna-cena-energii-elektrycznej", { next: { revalidate: 21600 } });
    if (!res.ok) return NextResponse.json({ ok:false, source:"pse", status:res.status }, { status:200 });
    const html = await res.text();
    const items = parseRCEm(html);
    return NextResponse.json({ ok:true, source:"pse", items });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status:200 });
  }
}
