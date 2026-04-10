export function getChartTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();

  return {
    grid: { stroke: v('--chart-grid'), strokeDasharray: '0', vertical: false },
    xAxis: {
      tick: { fill: v('--text-muted'), fontSize: 11, fontFamily: "'Inter', sans-serif" },
      axisLine: false, tickLine: false, tickMargin: 8,
    },
    yAxis: {
      tick: { fill: v('--text-muted'), fontSize: 11, fontFamily: "'Inter', sans-serif" },
      axisLine: false, tickLine: false, tickMargin: 8, width: 44,
    },
    tooltip: {
      contentStyle: {
        background: v('--chart-tooltip-bg'),
        border: `1px solid ${v('--chart-tooltip-border')}`,
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: v('--shadow-tooltip'),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      },
      labelStyle: {
        color: v('--text-secondary'),
        fontWeight: 600, fontSize: '11px',
        letterSpacing: '0.04em', textTransform: 'uppercase',
        marginBottom: '6px',
      },
      itemStyle: { color: v('--text-primary'), fontSize: '13px', padding: '2px 0' },
      cursor: { stroke: v('--border-strong'), strokeWidth: 1 },
    },
    colors: {
      heart: v('--color-heart'),
      hrv: v('--color-hrv'),
      vo2: v('--color-vo2'),
      sleep: v('--color-sleep'),
      activity: v('--color-activity'),
      risk: v('--color-risk'),
      spo2: v('--color-spo2'),
      green: v('--color-green'),
      amber: v('--color-amber'),
      red: v('--color-red'),
      blue: v('--color-blue'),
    },
    activeDot: (color) => ({
      r: 4, fill: color, stroke: v('--bg-card'), strokeWidth: 2,
    }),
    referenceLine: {
      stroke: v('--text-muted'), strokeDasharray: '3 4', strokeWidth: 1, strokeOpacity: 0.5,
    },
  };
}
