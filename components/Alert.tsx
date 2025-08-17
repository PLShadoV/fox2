export default function Alert({ title, children }:{ title: string; children?: React.ReactNode }){
  return (
    <div className="card p-4 border-amber-300/60 bg-amber-50/70">
      <div className="text-sm font-semibold mb-1">⚠️ {title}</div>
      {children && <div className="text-sm opacity-80">{children}</div>}
    </div>
  );
}
