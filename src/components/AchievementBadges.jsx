/**
 * AchievementBadges - Streaks and personal records computed client-side
 *
 * Usage:
 * <AchievementBadges
 *   steps={data.steps}
 *   workouts={data.workouts}
 *   sleepNightly={data.nightly}
 *   t={t}
 * />
 *
 * Props:
 *   steps        - steps object with .daily: [{ date, value }]
 *   workouts     - array of workout objects
 *   sleepNightly - array of { date, total, ... }
 *   t            - translation function
 */

import { useMemo } from 'react';

export default function AchievementBadges({ steps, workouts, sleepNightly, t }) {
  const achievements = useMemo(() => {
    const results = [];

    // ── Exercise streak: consecutive weeks with >= 2 workouts ──────────────
    if (workouts?.length) {
      // Build week -> count map. Week key = Monday's date string.
      const weekCounts = {};
      for (const w of workouts) {
        if (!w.date) continue;
        const d = new Date(w.date + 'T00:00:00');
        // Shift to Monday of that week
        const dow = d.getDay(); // 0=Sun
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((dow + 6) % 7));
        const key = monday.toISOString().slice(0, 10);
        weekCounts[key] = (weekCounts[key] ?? 0) + 1;
      }

      const sortedWeeks = Object.keys(weekCounts).sort();
      let maxStreak = 0;
      let currentStreak = 0;

      for (let i = 0; i < sortedWeeks.length; i++) {
        const key = sortedWeeks[i];
        const isActive = weekCounts[key] >= 2;

        if (isActive) {
          // Check if this week is exactly 7 days after the previous week
          if (i > 0) {
            const prev = new Date(sortedWeeks[i - 1] + 'T00:00:00');
            const curr = new Date(key + 'T00:00:00');
            const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
            if (diffDays === 7) {
              currentStreak++;
            } else {
              currentStreak = 1;
            }
          } else {
            currentStreak = 1;
          }
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      if (maxStreak > 0) {
        results.push({
          icon: 'O',
          label: t?.('achievements.exerciseStreak') ?? 'Exercise Streak',
          value: maxStreak,
          unit: t?.('achievements.weeks') ?? 'weeks',
          color: 'var(--color-vo2)',
        });
      }
    }

    // ── Sleep streak: consecutive nights >= 7h ─────────────────────────────
    if (sleepNightly?.length) {
      const sorted = [...sleepNightly].sort((a, b) => a.date.localeCompare(b.date));
      let maxStreak = 0;
      let currentStreak = 0;

      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].total >= 7) {
          // Verify consecutive (allow same-day duplicates to be treated as one)
          if (i > 0) {
            const prev = new Date(sorted[i - 1].date + 'T00:00:00');
            const curr = new Date(sorted[i].date + 'T00:00:00');
            const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              currentStreak = diffDays === 0 ? currentStreak : currentStreak + 1;
            } else {
              currentStreak = 1;
            }
          } else {
            currentStreak = 1;
          }
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      results.push({
        icon: 'C',
        label: t?.('achievements.sleepStreak') ?? 'Sleep \u22657h Streak',
        value: maxStreak,
        unit: t?.('achievements.nights') ?? 'nights',
        color: 'var(--color-sleep)',
      });
    }

    // ── Steps streak: consecutive days >= 8000 ─────────────────────────────
    if (steps?.daily?.length) {
      const sorted = [...steps.daily].sort((a, b) => a.date.localeCompare(b.date));
      let maxStreak = 0;
      let currentStreak = 0;

      for (let i = 0; i < sorted.length; i++) {
        const val = typeof sorted[i].value === 'number' ? sorted[i].value : 0;
        if (val >= 8000) {
          if (i > 0) {
            const prev = new Date(sorted[i - 1].date + 'T00:00:00');
            const curr = new Date(sorted[i].date + 'T00:00:00');
            const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              currentStreak = diffDays === 0 ? currentStreak : currentStreak + 1;
            } else {
              currentStreak = 1;
            }
          } else {
            currentStreak = 1;
          }
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      results.push({
        icon: 'Z',
        label: t?.('achievements.stepsStreak') ?? 'Steps \u22658K Streak',
        value: maxStreak,
        unit: t?.('achievements.days') ?? 'days',
        color: 'var(--color-activity)',
      });
    }

    // ── Personal records ───────────────────────────────────────────────────

    if (workouts?.length) {
      // Longest swim distance
      const swims = workouts.filter((w) => w.type === 'Swimming' && w.swimDistance > 0);
      if (swims.length) {
        const maxDist = Math.max(...swims.map((s) => s.swimDistance));
        results.push({
          icon: 'S',
          label: t?.('achievements.longestSwim') ?? 'Longest Swim',
          value: maxDist.toLocaleString(),
          unit: 'm',
          color: 'var(--color-activity)',
        });
      }

      // Longest workout duration
      const validDurations = workouts.map((w) => w.duration ?? 0).filter((d) => d > 0);
      if (validDurations.length) {
        const maxDuration = Math.max(...validDurations);
        results.push({
          icon: 'T',
          label: t?.('achievements.longestWorkout') ?? 'Longest Workout',
          value: maxDuration,
          unit: 'min',
          color: 'var(--color-vo2)',
        });
      }
    }

    // Most steps in a day
    if (steps?.daily?.length) {
      const maxSteps = Math.max(...steps.daily.map((s) => s.value ?? 0));
      if (maxSteps > 0) {
        results.push({
          icon: 'F',
          label: t?.('achievements.maxSteps') ?? 'Most Steps (1 Day)',
          value: maxSteps.toLocaleString(),
          unit: '',
          color: 'var(--color-hrv)',
        });
      }
    }

    return results;
  }, [steps, workouts, sleepNightly, t]);

  if (!achievements.length) return null;

  // Icon map: single-letter keys map to visible symbols
  const ICON_MAP = {
    O: '\u25CB', // exercise streak circle
    C: '\u25D6', // sleep crescent-like
    Z: '\u26A1', // steps bolt
    S: '\u25C6', // swim diamond
    T: '\u29D7', // timer hourglass-like
    F: '\u2606', // steps star
  };

  return (
    <div className="card" role="region" aria-label={t?.('achievements.title') ?? 'Achievements & Records'}>
      <p className="section-title" style={{ marginBottom: '16px' }}>
        {t?.('achievements.title') ?? 'Achievements & Records'}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        {achievements.map((a, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-inset)',
              borderRadius: 'var(--radius)',
              padding: '14px',
              borderLeft: `3px solid ${a.color}`,
              transition: 'background var(--transition-fast)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                fontSize: '18px',
                marginBottom: '6px',
                color: a.color,
                lineHeight: 1,
              }}
            >
              {ICON_MAP[a.icon] ?? a.icon}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
                lineHeight: 1.3,
              }}
            >
              {a.label}
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-heading)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {a.value}{' '}
              {a.unit && (
                <span
                  style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}
                >
                  {a.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
