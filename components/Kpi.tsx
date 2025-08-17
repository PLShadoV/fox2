export default function Kpi({ title, value, unit }:{ title: string; value: string; unit?: string; }){
  return (
    <div className="card kpi">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">
        {value} {unit ? <span className="text-slate-400 text-base align-top">{unit}</span> : null}
      </div>
    </div>
  );
}
