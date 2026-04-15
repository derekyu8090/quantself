import { createContext, useContext } from 'react';

export const DateRangeContext = createContext(null);

export const PRESETS = [
  { key: 'all', label: { en: 'All Time', zh: '全部' } },
  { key: '30d', label: { en: 'Last 30 Days', zh: '近30天' } },
  { key: '90d', label: { en: 'Last 90 Days', zh: '近90天' } },
  { key: '6m', label: { en: 'Last 6 Months', zh: '近6个月' } },
  { key: '1y', label: { en: 'Last Year', zh: '近1年' } },
  { key: 'custom', label: { en: 'Custom', zh: '自定义' } },
];

export function computeRange(preset) {
  if (preset === 'all') return { start: null, end: null };
  const end = new Date();
  const endStr = end.toISOString().slice(0, 10);
  let start = new Date();
  if (preset === '30d') start.setDate(start.getDate() - 30);
  else if (preset === '90d') start.setDate(start.getDate() - 90);
  else if (preset === '6m') start.setMonth(start.getMonth() - 6);
  else if (preset === '1y') start.setFullYear(start.getFullYear() - 1);
  return { start: start.toISOString().slice(0, 10), end: endStr };
}

export function useDateRange() {
  return useContext(DateRangeContext);
}
