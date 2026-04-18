import type { ReactNode } from 'react';

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  trend?: 'up' | 'down' | 'flat';
}

export function Stat({ label, value, sub, accent, trend }: StatProps) {
  const trendGlyph = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'flat' ? '→' : null;
  const trendColor = trend === 'up' ? '#6ee7b7' : trend === 'down' ? '#fca5a5' : 'var(--muted)';
  return (
    <div
      className="relative p-5 overflow-hidden"
      style={{
        background: accent ? 'rgba(99,102,241,0.04)' : 'var(--surface)',
        border: '1px solid',
        borderColor: accent ? 'rgba(99,102,241,0.18)' : 'var(--border)',
        borderRadius: 12,
      }}
    >
      <p className="eyebrow mb-3" style={{ fontSize: 10, letterSpacing: '0.16em' }}>
        {label}
      </p>
      <div
        className="font-display leading-none mb-1.5"
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: accent ? 'var(--accent-light)' : 'var(--text)',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          {trendGlyph && <span style={{ color: trendColor }}>{trendGlyph}</span>}
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}
