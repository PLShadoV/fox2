type Row = { hour: string; kwh: number; price?: number|null; revenue?: number|null };

export default function HourlyTable({ rows, date, priceLabel }:{ rows: Row[]; date: string; priceLabel: string }){
  const totalKWh = rows.reduce((a,b)=>a+(b.kwh||0),0);
  const totalRevenue = rows.reduce((a,b)=>a+(b.revenue||0),0);

  return (
    <div className="glass" style={{overflow:'hidden'}}>
      <div className="chart-wrap" style={{paddingBottom:0}}>
        <div style={{fontWeight:700, marginBottom:8}}>Tabela godzinowa — {date}</div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="table">
          <thead>
            <tr>
              <th>Godzina</th>
              <th>Generacja (kWh)</th>
              <th>{priceLabel}</th>
              <th>Przychód (PLN)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td className="kbd">{r.hour}</td>
                <td>{r.kwh.toFixed(2)}</td>
                <td>{r.price==null ? '—' : r.price.toFixed(2)}</td>
                <td>{r.revenue==null ? '—' : r.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="tfoot">
              <td>Suma</td>
              <td>{totalKWh.toFixed(2)}</td>
              <td>—</td>
              <td>{totalRevenue.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
