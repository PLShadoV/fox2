export const dynamic = "force-dynamic";
export const revalidate = 0;

import StatTile from "@/components/StatTile";
import RangeButtons from "@/components/RangeButtons";
import BarChartCard from "@/components/BarChartCard";
import HourlyRevenueTable from "@/components/HourlyRevenueTable";

function ensureProtocol(u: string){
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `https://${u}`;
}
function getBaseUrl(){
  // 1) explicit site URL has priority
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (site) return ensureProtocol(site);
  // 2) Vercel env
  const vercel = process.env.VERCEL_URL;
  if (vercel) return ensureProtocol(vercel);
  // 3) localhost fallback
  return "http://localhost:3000";
}

async function getJSON(path: string){
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  return res.json();
}

export default async function Page({ searchParams }: { searchParams: { date?: string } }) {
  const date = searchParams?.date || new Date().toISOString().slice(0,10);

  // Realtime power
  const pvJSON = await getJSON(`/api/foxess/realtime`).catch(()=> ({ pvNowW: null }));

  // Generation day summary
  const dayJSON = await getJSON(`/api/foxess/summary/day?date=${date}`)
    .catch(()=> ({ today:{ generation:{ total: null }}}));

  // Revenue from GENERATION
  const revJSON = await getJSON(`/api/revenue/day?date=${date}`)
    .catch(()=> ({ totals:{ revenue_pln: null }, rows: [] }));

  const hourly = (revJSON?.rows || []).map((r:any)=> ({ x: String(r.hour).padStart(2,"0")+":00", revenue: r.revenue_pln }));

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">PV Dashboard</h1>
        <RangeButtons />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatTile label="Moc teraz" value={pvJSON?.pvNowW != null ? `${pvJSON.pvNowW} W` : "—"} />
        <StatTile label="Wygenerowano (ten dzień)" value={dayJSON?.today?.generation?.total != null ? `${dayJSON.today.generation.total.toFixed(1)} kWh` : "—"} />
        <StatTile label="Dzisiejszy przychód" value={revJSON?.totals?.revenue_pln != null ? `${revJSON.totals.revenue_pln.toFixed(2)} PLN` : "—"} sub="Liczony z GENERATION × max(RCE,0)/1000" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard title={`Przychód na godzinę — ${date}`} data={hourly} xKey="x" yKey="revenue" formatter={(v)=> `${v} PLN`} />
      </div>

      <div className="space-y-2">
        <div className="text-sm text-zinc-500">Tabela godzinowa (generation, cena RCE, przychód) — {date}</div>
        <HourlyRevenueTable rows={revJSON?.rows || []} />
      </div>
    </div>
  );
}
