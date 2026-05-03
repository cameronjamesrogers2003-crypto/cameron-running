interface Stat {
  label: string;
  value: string;
  sub?: string;
}

interface StatsBarProps {
  stats: Stat[];
}

export default function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            {stat.label}
          </p>
          <p className="text-2xl font-bold mt-1 text-white">{stat.value}</p>
          {stat.sub && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {stat.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
