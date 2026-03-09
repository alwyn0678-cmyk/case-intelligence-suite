import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
  PieChart, Pie,
} from 'recharts';

const GRID  = '#2a2f3f';
const TEXT  = '#a6aec4';
const TT_BG = '#1d2030';

interface TooltipProps { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }

function DarkTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: TT_BG, border: `1px solid ${GRID}`, borderRadius: 6, padding: '8px 12px' }}>
      {label && <p style={{ color: TEXT, fontSize: 11, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 12, margin: '2px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Horizontal bar chart (top-N ranking) ──────────────────────
export function HBarChart({ data, dataKey = 'count', nameKey = 'name', color = '#8b7cff', height = 280 }:
  { data: Record<string, unknown>[]; dataKey?: string; nameKey?: string; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={nameKey} tick={{ fill: TEXT, fontSize: 11 }} width={130} axisLine={false} tickLine={false} />
        <Tooltip content={<DarkTooltip />} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Multi-series vertical bar chart ───────────────────────────
export function VBarChart({ data, bars, height = 280 }:
  { data: Record<string, unknown>[]; bars: Array<{ key: string; label: string; color: string }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ color: TEXT, fontSize: 11 }} />
        {bars.map(b => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} stackId="a" maxBarSize={28} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Line chart ────────────────────────────────────────────────
export function TrendLine({ data, lines, height = 220 }:
  { data: Record<string, unknown>[]; lines: Array<{ key: string; label: string; color: string }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="week" tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ color: TEXT, fontSize: 11 }} />
        {lines.map(l => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Donut / Pie chart ─────────────────────────────────────────
export function DonutChart({ data, height = 260 }:
  { data: Array<{ name: string; value: number; color: string }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" dataKey="value" nameKey="name" paddingAngle={2}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip content={<DarkTooltip />} />
        <Legend wrapperStyle={{ color: TEXT, fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
