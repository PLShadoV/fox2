type Props = { title: string; value: string; subtitle?: string };

export default function StatTile({ title, value, subtitle }: Props) {
  return (
    <div className="glass tile">
      <h3>{title}</h3>
      <div className="value">{value}</div>
      {subtitle && <div className="sub">{subtitle}</div>}
    </div>
  );
}
