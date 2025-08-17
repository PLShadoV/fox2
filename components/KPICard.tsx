export default function KPICard({ label, value, suffix }:{ label:string; value:string|number; suffix?:string }){
  return (
    <div className="card p-6">
      <div className="text-xs uppercase tracking-wide muted">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}{suffix}</div>
    </div>
  );
}
