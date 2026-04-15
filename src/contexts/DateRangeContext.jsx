import { useState, useMemo } from 'react';
import { DateRangeContext, PRESETS, computeRange } from './useDateRange';

export function DateRangeProvider({ children }) {
  const [preset, setPreset] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(() => {
    if (preset === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }
    return computeRange(preset);
  }, [preset, customStart, customEnd]);

  const value = {
    preset, setPreset,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    startDate: range.start,
    endDate: range.end,
    PRESETS,
  };

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}
