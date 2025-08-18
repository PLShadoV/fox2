import { NextResponse } from "next/server";

const MONTHS = [
  "styczeń","styczen","luty","marzec","kwiecień","kwiecien","maj","czerwiec","lipiec",
  "sierpień","sierpien","wrzesień","wrzesien","październik","pazdziernik","listopad","grudzień","grudzien"
];

function norm(txt:string){
  return txt.toLowerCase()
    .replaceAll("&nbsp;"," ")
    .replaceAll("\u00a0"," ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove diacritics
}

function parseRCEm(html:string){
  const out:{label:string, value:number|null}[] = [];
  const plain = norm(html);

  for (const m of MONTHS){
    const reM = new RegExp(`\\b${m}\\b`, "g");
    let match;
    while ((match = reM.exec(plain))){
      const start = match.index;
      const window = plain.slice(start, start+900);
      const idx = window.indexOf("rcem");
      if (idx === -1) continue;
      const after = window.slice(idx, idx+260);
      const numMatch = after.match(/(\d{1,4}(?:[.,]\d{2}))/);
      if (numMatch){
        const raw = numMatch[1].replace(",", ".");
        const val = Number(raw);
        if (!Number.isNaN(val)){
          const label = m.replace("pazdziernik","październik").replace("kwiecien","kwiecień").replace("styczen","styczeń").replace("sierpien","sierpień").replace("wrzesien","wrzesień").replace("grudzien","grudzień");
          if (!out.find(x => x.label === label)) out.push({ label, value: val });
        }
      }
    }
  }
  return out;
}

export async function GET(){
  try{
    const url = "https://www.pse.pl/oire/rcem-rynkowa-miesieczna-cena-energii-elektrycznej";
    const res = await fetch(url, { next: { revalidate: 21600 } }); // 6h
    if (!res.ok){
      return NextResponse.json({ ok:false, source:"pse", status:res.status }, { status: 200 });
    }
    const html = await res.text();
    const parsed = parseRCEm(html);
    const order = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
    parsed.sort((a,b)=> order.indexOf(a.label) - order.indexOf(b.label));
    return NextResponse.json({ ok:true, source:"pse", items: parsed });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message || String(e) }, { status: 200 });
  }
}
