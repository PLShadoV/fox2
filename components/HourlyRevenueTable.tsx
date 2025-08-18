"use client";
export default function HourlyRevenueTable({ rows }: { rows: Array<{hour:number;kwh:number;price_pln_mwh:number;price_used_pln_mwh:number;revenue_pln:number;}> }) {
  const totalKWh = rows.reduce((a,r)=>a+r.kwh,0);
  const totalPLN = rows.reduce((a,r)=>a+r.revenue_pln,0);
  return (
    <div className="overflow-auto rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-lg shadow-sky-100/40">
      <table className="w-full text-sm text-sky-900">
        <thead className="sticky top-0 bg-white/70 backdrop-blur-xl">
          <tr>
            <th className="text-left px-4 py-3">Godzina</th>
            <th className="text-right px-4 py-3">Generacja (kWh)</th>
            <th className="text-right px-4 py-3">Cena RCE (PLN/MWh)</th>
            <th className="text-right px-4 py-3">Cena użyta (PLN/MWh)</th>
            <th className="text-right px-4 py-3">Przychód (PLN)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=> (
            <tr key={r.hour} className="border-t border-sky-100/60">
              <td className="px-4 py-2">{String(r.hour).padStart(2,"0")}:00</td>
              <td className="px-4 py-2 text-right">{r.kwh.toFixed(2)}</td>
              <td className="px-4 py-2 text-right">{r.price_pln_mwh.toFixed(2)}</td>
              <td className="px-4 py-2 text-right">{r.price_used_pln_mwh.toFixed(2)}</td>
              <td className="px-4 py-2 text-right font-medium">{r.revenue_pln.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-sky-200/80 bg-white/70 backdrop-blur-xl">
            <td className="px-4 py-3 font-medium">Suma</td>
            <td className="px-4 py-3 text-right font-medium">{totalKWh.toFixed(2)}</td>
            <td></td><td></td>
            <td className="px-4 py-3 text-right font-semibold">{totalPLN.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
