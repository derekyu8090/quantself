/**
 * Format "2023-08" → "Aug '23" (en) or "2023年8月" (zh)
 */
export function fmtMonth(monthStr, lang = 'en') {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  if (lang === 'zh') return `${y}年${parseInt(m)}月`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

/**
 * Format "2023-08-04" → "Aug 4, 2023" (en) or "2023-08-04" (zh)
 */
export function fmtDate(dateStr, lang = 'en') {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  if (lang === 'zh') return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format hour number: 14 → "2 PM" (en) or "14:00" (zh)
 */
export function fmtHour(h, lang = 'en') {
  if (lang === 'zh') return `${h}:00`;
  if (h === 0)  return '12 AM';
  if (h < 12)  return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

/**
 * Format bedtime fractional hours: 27.5 → "03:30"
 */
export function formatBedtime(h) {
  if (h == null) return '--';
  const hour = Math.floor(h) % 24;
  const min = Math.round((h % 1) * 60);
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

/**
 * Format "2023-08-04" → "08/04" (zh-CN MM/DD, used for chart axis labels in ActivityPanel)
 */
export function fmtDateShortZh(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/**
 * Format "2023-08" → "8月" (zh-CN short month label, used for chart axis labels in ActivityPanel)
 */
export function fmtMonthShortZh(monthStr) {
  if (!monthStr) return '';
  const [, m] = monthStr.split('-');
  return m ? `${parseInt(m, 10)}月` : monthStr;
}

/**
 * Format "2023-08-04" → "2023/08/04" (zh-CN full date, used in RiskPanel anomaly timeline)
 */
export function fmtDateFullZh(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * Filter array of objects by date range.
 * Items must have a `date` (string "YYYY-MM-DD") or `month` (string "YYYY-MM") field.
 */
export function filterByDateRange(data, startDate, endDate, dateField = 'date') {
  if (!data || !startDate || !endDate) return data;
  return data.filter(item => {
    const d = item[dateField];
    if (!d) return true;
    return d >= startDate && d <= endDate;
  });
}

/**
 * Compute statistics for an array of numbers.
 */
export function computeStats(values) {
  if (!values || values.length === 0) return { mean: 0, median: 0, stddev: 0, min: 0, max: 0, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  return {
    mean: Math.round(mean * 10) / 10,
    median: Math.round(median * 10) / 10,
    stddev: Math.round(stddev * 10) / 10,
    min: sorted[0],
    max: sorted[n - 1],
    count: n,
  };
}

/**
 * Group array of {date, ...} objects by month.
 * Returns Map<monthStr, items[]>
 */
export function groupByMonth(data, dateField = 'date') {
  const groups = new Map();
  for (const item of (data || [])) {
    const month = (item[dateField] || '').slice(0, 7);
    if (!month) continue;
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(item);
  }
  return groups;
}

/**
 * Group array of {date, ...} objects by ISO week.
 */
export function groupByWeek(data, dateField = 'date') {
  const groups = new Map();
  for (const item of (data || [])) {
    const d = new Date(item[dateField]);
    if (isNaN(d)) continue;
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}
