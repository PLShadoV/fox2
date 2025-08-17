import BarChartCard from "@/components/BarChartCard";
import KPICard from "@/components/KPICard";
import Alert from "@/components/Alert";

async function fetchJSON(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: String(e) } };
  }
}

function toHourLabels(values:number[], date:string){
  return values.map((_,i)=>({ label: `${String(i).padStart(2,'0')}:00`, hour: i, date }));
}

export default async function Page(){
  const today = new Date();
  const date = today.toISOString().slice(0,10); // YYYY-MM-DD

  const [foxRes, rceRes] = await Promise.all([
    fetchJSON(`/api/foxess?date=${date}`),
    fetchJSON(`/api/rce?date=${date}`),
  ]);

  const fox = foxRes.data || {};
  const rce = rceRes.data || {};

  const feedin = fox.result?.find((v:any)=>v.variable === "feedin");
  const generation = fox.result?.find((v:any)=>v.variable === "generation");
  const feedinVals: number[] = feedin?.values || []; // kWh per hour
  const rceRows = (rce.rows as Array<{ udtczas: string; rce_pln: number }>) || [];

  const hourly = toHourLabels(feedinVals, date).map((row, i) => {
    const r = rceRows[i];
    const rceMWh = r?.rce_pln ?? 0; // PLN/MWh
    const pricePerKWh = rceMWh / 1000; // PLN/kWh
    const kwh = feedinVals[i] || 0;
    return { x: row.label, kwh, pln: +(kwh * pricePerKWh).toFixed(2), rceMWh };
  });

  const totalKWh = hourly.reduce((a,b)=>a+b.kwh,0);
  const totalPLN = hourly.reduce((a,b)=>a+b.pln,0);
  const avgPrice = totalKWh ? totalPLN / totalKWh : 0;

  const hasFoxError = !foxRes.ok || fox?.ok === false;
  const hasRceError = !rceRes.ok || rce?.ok === false;

  return (
    <main className="space-y-6">
      {(hasFoxError || hasRceError) && (
        <Alert title="Aplikacja działa, ale brakuje danych">
          {hasFoxError && <div>FoxESS: {fox?.error || "sprawdź FOXESS_API_KEY i FOXESS_INVERTER_SN w zmiennych środowiskowych."}</div>}
          {hasRceError && <div>PSE RCE: {rce?.error || "sprawdź dostępność API raporów PSE."}</div>}
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Dzisiejszy zarobek" value={totalPLN.toFixed(2)} suffix=" PLN" />
        <KPICard label="Oddane (dziś)" value={totalKWh.toFixed(2)} suffix=" kWh" />
        <KPICard label="Śr. cena (dziś)" value={avgPrice.toFixed(2)} suffix=" PLN/kWh" />
        <KPICard label="Generacja (dziś)" value={(generation?.values?.reduce((a:number,b:number)=>a+b,0)||0).toFixed(2)} suffix=" kWh" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BarChartCard title={`Przychód na godzinę — ${date}`} data={hourly} xKey="x" yKey="pln" />
        <BarChartCard title={`Oddanie (kWh) na godzinę — ${date}`} data={hourly} xKey="x" yKey="kwh" />
      </div>
    </main>
  );
}
