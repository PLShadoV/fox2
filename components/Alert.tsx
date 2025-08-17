export default function Alert({ title, children }:{ title: string; children?: React.ReactNode }){
  return (
    <div className="card p-4 border-amber-300 bg-amber-50 dark:bg-amber-100">
      <div className="text-sm font-semibold mb-1">⚠️ {title}</div>
      {children && <div className="text-sm muted">{children}</div>}
    </div>
  );
}
