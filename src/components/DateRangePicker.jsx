import { useDateRange } from '../contexts/DateRangeContext';

function DateRangePicker({ lang }) {
  const {
    preset,
    setPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    PRESETS,
  } = useDateRange();

  return (
    <div className="date-range-picker">
      <div className="date-range-presets">
        {PRESETS.filter((p) => p.key !== 'custom').map((p) => (
          <button
            key={p.key}
            className={`date-preset-btn${preset === p.key ? ' active' : ''}`}
            onClick={() => setPreset(p.key)}
          >
            {p.label[lang] || p.label.en}
          </button>
        ))}
        <button
          className={`date-preset-btn${preset === 'custom' ? ' active' : ''}`}
          onClick={() => setPreset('custom')}
        >
          {lang === 'zh' ? '自定义' : 'Custom'}
        </button>
      </div>

      {preset === 'custom' && (
        <div className="date-range-custom">
          <input
            type="date"
            className="date-range-input"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            aria-label="Start date"
          />
          <span className="date-range-sep">–</span>
          <input
            type="date"
            className="date-range-input"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            aria-label="End date"
          />
        </div>
      )}
    </div>
  );
}

export default DateRangePicker;
