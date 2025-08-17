export default function KPICard({ label, value, suffix }:{ label:string; value:string|number; suffix?:string }){
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}{suffix}</div>
    </div>
  );
}
