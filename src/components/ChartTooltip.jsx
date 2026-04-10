/**
 * ChartTooltip - Shared tooltip component for all Recharts charts.
 *
 * Usage (inside a Recharts <LineChart> or <BarChart>):
 *   import ChartTooltip from './ChartTooltip'
 *   <Tooltip content={<ChartTooltip />} />
 *   <Tooltip content={<ChartTooltip formatter={(v, name) => [`${v} bpm`, name]} />} />
 *   <Tooltip content={<ChartTooltip labelFormatter={(l) => `Week of ${l}`} />} />
 *
 * Props (injected by Recharts + optionally passed directly):
 *   active         {boolean}   - Whether the tooltip is visible
 *   payload        {Array}     - Data entries from Recharts
 *   label          {*}         - X-axis label value
 *   formatter      {Function}  - (value, name) => [formattedValue, formattedName]
 *   labelFormatter {Function}  - (label) => formattedLabel
 */

const styles = {
  container: {
    background: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 8,
    padding: '10px 14px',
    boxShadow: 'var(--shadow-tooltip)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    fontFamily: "'Inter', var(--font-sans)",
    minWidth: 140,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 8,
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' },
  swatch: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 },
  value: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-heading)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
};

function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div style={styles.container}>
      <p style={styles.label}>
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      {payload.map((entry, i) => {
        const color = entry.color || entry.stroke;
        const [formattedValue, formattedName] = formatter
          ? [].concat(formatter(entry.value, entry.name))
          : [
              typeof entry.value === 'number'
                ? entry.value.toFixed(1)
                : entry.value,
              entry.name,
            ];

        return (
          <div key={i} style={styles.row}>
            <span style={{ ...styles.swatch, background: color }} />
            <span style={styles.name}>{formattedName ?? entry.name}</span>
            <span style={styles.value}>{formattedValue}</span>
          </div>
        );
      })}
    </div>
  );
}

export default ChartTooltip;
