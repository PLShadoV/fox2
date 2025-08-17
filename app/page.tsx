import Toolbar from "@/components/Toolbar";
import Kpi from "@/components/Kpi";
import BarChartCard from "@/components/BarChartCard";
import { format } from "date-fns";
import { headers } from "next/headers";

type HourRow = { x: string; hour: number; kwh: number; priceMWh: number; priceShown: number; revenuePLN: number };

function getBaseUrl(){
  const fromEnv = (process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  if (fromEnv) return fromEnv.replace(/\/+$/,"");
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

async function getData(date: string){
  const base = getBaseUrl();
  const foxUrl = `${base}/api/foxess?date=${date}`;
  const rceUrl = `${base}/api/rce?date=${date}`;
  const [foxRes, rceRes] = await Promise.all([fetch(foxUrl, { cache: "no-store" }), fetch(rceUrl, { cache: "no-store" })]);
  const fox = await foxRes.json();
  const rce = await rceRes.json();
  return { fox, rce };
}

async function getRealtime(){
  const base = getBaseUrl();
  const url = `${base}/api/foxess/debug/realtime`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    return await r.json();
  } catch { return { ok:false }; }
}

export default async function Page({ searchParams }: { searchParams: { [k:string]: string | string[] | undefined } }){
  const date = typeof searchParams.date === "string" ? searchParams.date : format(new Date(), "yyyy-MM-dd");
  const { fox, rce } = await getData(date);
  const realtime = await getRealtime();

  const exportArr: number[] = fox?.exportKWh || [];
  const rceRows: any[] = rce?.rows || [];

  const hourly: HourRow[] = new Array(24).fill(0).map((_,h)=>{
    const kwh = +(exportArr[h] || 0);
    const price = Number(rceRows[h]?.rce_pln_mwh || 0);
    const priceShown = price; // pokazujemy faktyczny (może być ujemny), ale do liczenia użyjemy max(0, price)
    const priceForCalc = Math.max(0, price);
    const revenuePLN = +(kwh * (priceForCalc / 1000)).toFixed(2);
    return { x: String(h).padStart(2, "0")+":00", hour: h, kwh, priceMWh: price, priceShown, revenuePLN };
  });

  const totalKWh = hourly.reduce((a,b)=> a + b.kwh, 0);
  const totalRevenue = hourly.reduce((a,b)=> a + b.revenuePLN, 0);
  const pvNow = realtime?.pvNowW ?? null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold">FoxESS + RCE — {date}</h1>
      <Toolbar />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Moc teraz" value={pvNow!=null ? (pvNow/1000).toFixed(2) : "-"} unit="kW" />
        <Kpi title="Oddane (ten dzień)" value={totalKWh.toFixed(2)} unit="kWh" />
        <Kpi title="Dzisiejszy zarobek" value={totalRevenue.toFixed(2)} unit="PLN" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard title={`Przychód na godzinę — ${date}`} data={hourly} xKey="x" yKey="revenuePLN" />
        <BarChartCard title={`Oddanie (kWh) na godzinę — ${date}`} data={hourly} xKey="x" yKey="kwh" />
      </div>

      <div className="card p-4">
        <div className="font-semibold mb-3">Tabela — produkcja/eksport, ceny RCE, przychód</div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Godzina</th>
                <th>Oddane [kWh]</th>
                <th>Cena RCE [PLN/MWh]</th>
                <th>Do obliczeń [PLN/MWh]</th>
                <th>Przychód [PLN]</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((r, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td>{r.x}</td>
                  <td>{r.kwh.toFixed(3)}</td>
                  <td>{r.priceShown.toFixed(2)}</td>
                  <td>{Math.max(0, r.priceMWh).toFixed(2)}</td>
                  <td>{r.revenuePLN.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Suma</td>
                <td>{totalKWh.toFixed(3)}</td>
                <td>—</td>
                <td>—</td>
                <td>{totalRevenue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Uwaga: ceny RCE ujemne są pokazywane w tabeli, ale do obliczeń przyjmujemy 0 (zgodnie z wymaganiem).
      </div>
    </div>
  );
}
