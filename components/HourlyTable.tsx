export default function HourlyTable({ rows }:{ rows: { hour: string; kwh: number; priceMWh: number; revenuePLN: number }[] }){
  const total = rows.reduce((acc, r)=>{
    acc.kwh += r.kwh; acc.revenue += r.revenuePLN; return acc;
  }, { kwh: 0, revenue: 0 });
  return (
    <div className="card p-4 overflow-x-auto">
      <div className="text-base font-medium mb-3">Tabela godzinowa</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-2 pr-3">Godzina</th>
            <th className="py-2 pr-3">Produkcja (kWh)</th>
            <th className="py-2 pr-3">RCE (PLN/MWh)</th>
            <th className="py-2 pr-3">Przychód (PLN)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i)=> (
            <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60">
              <td className="py-2 pr-3">{r.hour}</td>
              <td className="py-2 pr-3">{r.kwh.toFixed(3)}</td>
              <td className="py-2 pr-3">{r.priceMWh.toFixed(2)}</td>
              <td className="py-2 pr-3">{r.revenuePLN.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 pr-3 font-semibold">Suma</td>
            <td className="py-2 pr-3 font-semibold">{total.kwh.toFixed(3)}</td>
            <td className="py-2 pr-3 muted">—</td>
            <td className="py-2 pr-3 font-semibold">{total.revenue.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
