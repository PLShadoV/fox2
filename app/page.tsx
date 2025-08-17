export const dynamic = "force-dynamic";

import BarChartCard from "@/components/BarChartCard";
import KPICard from "@/components/KPICard";
import Alert from "@/components/Alert";
import RangeControls from "@/components/RangeControls";
import HourlyTable from "@/components/HourlyTable";
import { foxReportQuery, foxRealtimeQuery, foxReportQuerySplit, foxHistoryDay } from "@/lib/foxess";
import { getDayExportAndGenerationKWh } from "@/lib/foxess-history-robust";
import { fetchRCEForDate } from "@/lib/pse";

type SearchParams = { [key: string]: string | string[] | undefined };

function parseSP(sp: SearchParams, key: string, def?: string){
  const v = sp[key]; if (!v) return def;
  return Array.isArray(v) ? v[0] : v;
}

function startOfWeek(d: Date){
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7; // Mon=1..Sun=7
  x.setUTCDate(x.getUTCDate() - (day-1));
  return x;
}
function endOfWeek(d: Date){
  const s = startOfWeek(d);
  const e = new Date(s); e.setUTCDate(e.getUTCDate()+6);
  return e;
}

function dateISO(d: Date){ return d.toISOString().slice(0,10); }

async function getDayData(date: string){
  const [y,m,day] = date.split("-").map(Number);
  let fox:any = null, rce:any = null, foxError:string|undefined, rceError:string|undefined;
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    const hasToken = !!(process.env.FOXESS_API_KEY || process.env.FOXESS_OAUTH_BEARER);
    if (!sn || !hasToken) throw new Error("Brak konfiguracji FOXESS (FOXESS_INVERTER_SN lub token).");
    const EXPORT_VARS = ["feedin","feedIn","gridExportEnergy","gridExport","export","exportEnergy","gridOutEnergy","gridOut","sell","sellEnergy","toGrid","toGridEnergy","eOut"];
    const GEN_VARS = ["generation","pvGeneration","production","yield","gen","eDay","dayEnergy"];
    
const result = await foxReportQuerySplit({ sn, date, exportVars: EXPORT_VARS, genVars: GEN_VARS, lang: process.env.FOXESS_API_LANG || "pl" });
let merged = result || [];
// jeśli pusto, spróbuj przez history/query
if (!merged.length) {
  const exp = await foxHistoryDay({ sn, date, variables: EXPORT_VARS });
  const gen = await foxHistoryDay({ sn, date, variables: GEN_VARS });
  merged = [...(exp||[]), ...(gen||[])];
}
fox = { result: merged };

  } catch (e:any) { foxError = String(e?.message || e); }

  try { rce = { rows: await fetchRCEForDate(date) }; }
  catch (e:any) { rceError = String(e?.message || e); }

  return { fox, rce, foxError, rceError };
}

async function getRealtime(){
  try {
    const sn = process.env.FOXESS_INVERTER_SN || "";
    if (!sn) return { pv: null };
    const r = await foxRealtimeQuery({ sn });
    return { pv: r?.pvNowW ?? null };
  } catch { return { pv: null }; }
}

function pickVarFromResult(result:any[], names: string[]){
  const lower = (s:string)=> (s||'').toLowerCase();
  return result.find((v:any)=> names.map(lower).includes(lower(v.variable)));
}

export default async function Page({ searchParams }:{ searchParams: SearchParams }){
  const view = parseSP(searchParams, "view", "day")!;
  const today = new Date();
  const date = parseSP(searchParams, "date", today.toISOString().slice(0,10))!;

  const realtime = await getRealtime();

  const { fox, rce, foxError, rceError } = await getDayData(date);

  const feedin = pickVarFromResult(fox?.result || [], ["feedin","feedIn","gridExportEnergy","gridExport","export","exportEnergy","gridOutEnergy","gridOut","sell","sellEnergy","toGrid","toGridEnergy","eOut"]);
  const generation = pickVarFromResult(fox?.result || [], ["generation","pvGeneration","production","yield","gen","eDay","dayEnergy"]);
  let feedinVals: number[] = feedin?.values || [];
  let genVals: number[] = generation?.values || [];
  if ((feedinVals.length === 0 || feedinVals.every(v=>!v)) || (genVals.length === 0 || genVals.every(v=>!v))) {
    try {
      const robust = await getDayExportAndGenerationKWh(process.env.FOXESS_INVERTER_SN || "", date);
      if (feedinVals.every(v=>!v)) feedinVals = robust.export.values || [];
      if (genVals.every(v=>!v)) genVals = robust.generation.values || [];
    } catch {}
  }
  const rceRows = (rce?.rows as Array<{ timeISO: string; rce_pln_mwh: number }>) || [];

  const hourly = Array.from({ length: 24 }).map((_, i) => {
    const label = `${String(i).padStart(2,'0')}:00`;
    const kwh = feedinVals[i] || 0;
    const priceMWh = Number(rceRows[i]?.rce_pln_mwh ?? 0);
    const effPricePerKWh = Math.max(priceMWh, 0) / 1000; // ujemne ceny liczymy jako 0
    const revenuePLN = +(kwh * effPricePerKWh).toFixed(2);
    return { x: label, hour: label, kwh, gen: genVals[i] || 0, priceMWh, revenuePLN };
  });

  const totalKWh = hourly.reduce((a,b)=>a+b.kwh,0);
  const totalPLN = hourly.reduce((a,b)=>a+b.revenuePLN,0);
  const avgPrice = totalKWh ? totalPLN / totalKWh : 0;

  let aggBars: { key: string; kwh: number; pln: number }[] = [];
  if (view !== "day") {
    let start: Date; let end: Date;
    const base = new Date(date + "T00:00:00Z");
    if (view === "week") { start = startOfWeek(base); end = endOfWeek(base); }
    else if (view === "month") { start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)); end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth()+1, 0)); }
    else { start = new Date(Date.UTC(base.getUTCFullYear(), 0, 1)); end = new Date(Date.UTC(base.getUTCFullYear(), 11, 31)); }
    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) { days.push(dateISO(cursor)); cursor.setUTCDate(cursor.getUTCDate()+1); }

    const sn = process.env.FOXESS_INVERTER_SN || "";
    const hasToken = !!(process.env.FOXESS_API_KEY || process.env.FOXESS_OAUTH_BEARER);
    if (sn && hasToken) {
      const dayData = await Promise.all(days.map(async dstr => {
        try {
          const EXPORT_VARS = ["feedin","feedIn","gridExportEnergy","gridExport","export","exportEnergy","gridOutEnergy","gridOut","sell","sellEnergy","toGrid","toGridEnergy","eOut"];
          const result = await foxReportQuerySplit({ sn, date: dstr, exportVars: EXPORT_VARS, genVars: [], lang: process.env.FOXESS_API_LANG || "pl" });
          const exportVar = pickVarFromResult(result, EXPORT_VARS);
          const kwhArr = (exportVar?.values || []);
          let pln = 0, kwh = 0;
          const rcerows = await fetchRCEForDate(dstr);
          for (let i=0;i<24;i++) {
            const priceMWh = Number(rcerows[i]?.rce_pln_mwh ?? 0);
            const eff = Math.max(priceMWh,0)/1000;
            const v = Number(kwhArr[i] || 0);
            kwh += v;
            pln += v * eff;
          }
          return { key: dstr.slice(5), kwh: +kwh.toFixed(2), pln: +pln.toFixed(2) };
        } catch { return { key: dstr.slice(5), kwh: 0, pln: 0 }; }
      }));
      aggBars = dayData;
    }
  }

  const hasFoxError = !!foxError;
  const hasRceError = !!rceError;

  return (
    <main className="space-y-6">
      <RangeControls />

      <div className="card p-3 text-xs">
        <div className="font-semibold mb-1">Debug</div>
        <div>Moc teraz (W) → {realtime.pv ?? "—"}</div>
        <div>Oddane zmienna → {feedin?.variable ?? "—"}</div>
        <div>Generacja zmienna → {generation?.variable ?? "—"}</div>
      </div>

      {(hasFoxError || hasRceError) && (
        <Alert title="Aplikacja działa, ale brakuje danych">
          {hasFoxError && <div>FoxESS: {foxError}</div>}
          {hasRceError && <div>PSE RCE: {rceError}</div>}
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Dzisiejszy zarobek" value={totalPLN.toFixed(2)} suffix=" PLN" />
        <KPICard label="Oddane (ten dzień)" value={totalKWh.toFixed(2)} suffix=" kWh" />
        <KPICard label="Śr. cena (dzień)" value={avgPrice.toFixed(2)} suffix=" PLN/kWh" />
        <KPICard label="Generacja (dzień)" value={(hourly.reduce((a,b)=>a+b.gen,0)).toFixed(2)} suffix=" kWh" />
        <KPICard label="Moc teraz" value={realtime.pv!==null ? Number(realtime.pv).toFixed(0) : "—"} suffix={realtime.pv!==null ? " W" : ""} />
      </div>

      {view === "day" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BarChartCard title={`Przychód na godzinę — ${date}`} data={hourly} xKey="x" yKey="revenuePLN" name="PLN" />
            <BarChartCard title={`Oddanie (kWh) na godzinę — ${date}`} data={hourly} xKey="x" yKey="kwh" name="kWh" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <BarChartCard title={`Generacja (kWh) na godzinę — ${date}`} data={hourly} xKey="x" yKey="gen" name="kWh" />
            <BarChartCard title={`RCE (PLN/MWh) — ${date}`} data={hourly} xKey="x" yKey="priceMWh" name="PLN/MWh" />
          </div>
          <HourlyTable rows={hourly.map(h=>({ hour: h.hour, kwh: h.kwh, priceMWh: h.priceMWh, revenuePLN: h.revenuePLN }))} />
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BarChartCard title={`Przychód — ${view}`} data={aggBars} xKey="key" yKey="pln" name="PLN" />
          <BarChartCard title={`Oddanie (kWh) — ${view}`} data={aggBars} xKey="key" yKey="kwh" name="kWh" />
        </div>
      )}
    </main>
  );
}
