import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type Item = { monthIndex:number; monthLabel:string; year:number; value:number|null; ym:string };

const MONTHS_PL = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];

function itemsFromFallback(baseDir:string): Item[] {
  try{
    const full = path.join(baseDir, "data", "rcem.json");
    const raw = fs.readFileSync(full, "utf8");
    const map = JSON.parse(raw) as Record<string, number>;
    const out: Item[] = [];
    for (const [ym, val] of Object.entries(map)){
      const [y,m] = ym.split("-").map(Number);
      const idx = (m||1)-1;
      out.push({ ym, monthIndex: idx, monthLabel: MONTHS_PL[idx], year: y, value: Number(val)||null });
    }
    // sort newest first
    out.sort((a,b)=> (b.year - a.year) || (b.monthIndex - a.monthIndex));
    return out;
  }catch{
    return [];
  }
}

export async function GET(){
  // We *try* to fetch from PSE, but if it fails or yields no rows we fall back to local data file.
  try{
    const url = "https://www.pse.pl/oire/rcem-rynkowa-cena-energii-elektrycznej";
    const res = await fetch(url, { next: { revalidate: 21600 } as any });
    if (res.ok){
      const html = await res.text();
      // VERY permissive regex – looks for "styczeń 2025 ... 420,54 zł/MWh"
      const text = html.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const months = ["styczen","luty","marzec","kwiecien","maj","czerwiec","lipiec","sierpien","wrzesien","pazdziernik","listopad","grudzien"];
      const REG = new RegExp(`(${months.join("|")})\s+(20\d{2}).{0,60}?(\d+[\.,]\d+)\s*zl\s*/\s*MWh`, "gi");
      const found: Item[] = [];
      let m: RegExpExecArray | null;
      while ((m = REG.exec(text))){
        const monName = m[1].toLowerCase();
        const year = Number(m[2]);
        const value = Number(String(m[3]).replace(",", ".") || "0");
        const monthIndex = months.indexOf(monName);
        const ym = `${year}-${String(monthIndex+1).padStart(2,"0")}`;
        found.push({ ym, monthIndex, monthLabel: MONTHS_PL[monthIndex], year, value });
      }
      found.sort((a,b)=> (b.year - a.year) || (b.monthIndex - a.monthIndex));
      if (found.length) {
        return NextResponse.json({ ok:true, source:"pse", items: found });
      }
    }
  }catch{/* noop */}

  // fallback to bundled JSON
  const items = itemsFromFallback(process.cwd());
  if (!items.length) return NextResponse.json({ ok:false, error: "RCEm endpoint returned no data" }, { status: 200 });
  return NextResponse.json({ ok:true, source:"fallback", items });
}
