# QuantSelf - Project Context

## What is this
Open-source personal health dashboard. Visualizes Apple Health + Arboleaf body scale data with interactive charts, two composite health scores (daily + longevity), 8-dimension risk assessment, AI weekly reports, and correlation discovery.

## Current version: v1.7

## Tech stack
- Frontend: React 19 + Recharts 3 + Vite 8
- Desktop: Tauri 2.10 (Rust), installed at /Applications/QuantSelf.app
- Data pipeline: Python (stdlib + openpyxl for Arboleaf xlsx)
- AI: Claude API via urllib (no SDK dependency)
- Config: .env contains ANTHROPIC_API_KEY (gitignored)

## Key commands
- `npm run dev` — start web dashboard at localhost:5173
- `python3 process_data.py ~/Downloads/apple_health_export` — update data
- `python3 process_data.py ~/Downloads/apple_health_export --arboleaf ~/Downloads/身体指数*.xlsx` — update with body scale
- `npx tauri build` — rebuild macOS desktop app
- `/health-update` — Claude Code skill for data updates

## Architecture
```
process_data.py (XML/XLSX → JSON)  →  public/data/*.json (gitignored)
                                          ↓
src/App.jsx (tabs, theme, lang)    →  8 panel components + 3 top cards
                                          ↓
                                   localhost:5173 or Tauri .app
```

## Data files (public/data/, gitignored)
- cardiovascular.json — RHR, HRV, VO2Max, SpO2, respiratory, walking HR, 24h HR profile
- sleep.json — nightly stages, bedtime, breathing disturbances, wrist temperature
- activity.json — steps, workouts, exercise time, stand hours, daylight, mobility, headphone, flights, basal energy, cycling, walking steadiness, six-min walk, Arboleaf body composition
- overview.json — healthScore (daily), longevityScore (monthly, evidence-based), risks (8 dimensions), goals, baselines, anomalies, correlations, weeklyReport (AI)
- ecg.json — 24 ECG waveform recordings

## Panels (8 tabs)
Cardiovascular, Sleep, Activity, Risk & Goals, Compare, ECG, Insights (correlations), Glossary

## Top cards (always visible)
- HealthScoreCard — daily 0-100 (shows yesterday's complete data, not today's partial)
- LongevityScoreCard — evidence-based 0-100 with 8 weighted components and peer-reviewed references
- BaselineAlerts — 30-day rolling baseline deviation detection

## Background services
- fswatch watcher: ~/Library/LaunchAgents/com.quantself.watcher.plist — monitors Downloads + iCloud for new exports
- Watcher log: ~/.quantself-watcher.log

## Scoring methodology
- Daily score: Sleep 23% + HRV 18% + RHR 13% + Activity 13% + Recovery 13% + Daylight 10% + Body 10%
- Longevity score: VO2Max 25% (Kodama 2009) + Sleep Regularity 20% (Windred 2024) + Activity 20% (Paluch 2022) + HRV 15% (Hillebrand 2013) + Daylight 8% + Body Composition 8% + SpO2 5% (Yan 2024) + RHR 5% (Aune 2017)

## User preferences
- Default language: Chinese (zh)
- Default theme: follows system preference
- Session ID lookup rule is in global CLAUDE.md

## Conventions
- Python interpreter: use the `python3` in your PATH that has pandas and openpyxl installed (anaconda or venv)
- Data inspection: always inspect data structure/format before writing analysis code
- Test files: remove .py test files after successful analysis runs
- Do not create .md files without user approval
- No personal names or personal data values in code/docs/README
- Commit messages: include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- public/data/*.json is gitignored — never commit personal health data
- .env is gitignored — contains ANTHROPIC_API_KEY
