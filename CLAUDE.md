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

## Privacy & Commit Safety (CRITICAL — repository is PUBLIC)

This is a public GitHub repository. Before EVERY commit, scan staged changes for personal information. A single leaked DOB or username in a commit cannot be fully retracted — public history can be cached, indexed, or forked. Prior incident (Apr 2026, commits prior to `df6b6c9`) leaked a real DOB and macOS username; required `git filter-repo` + force push to clean, which does NOT retrieve what was already crawled.

**Always run before `git add`/`git commit`:**
```bash
# Scan staged + new files for personal info patterns
git diff --cached | grep -En "199[0-9]-[0-1][0-9]-[0-3][0-9]|/Users/[a-z]+|[a-zA-Z0-9._%+-]+@gmail\.com|[a-zA-Z0-9._%+-]+@(?!users\.noreply)" || echo "clean"
```

**Never commit these, even as default values or examples:**
- Real dates of birth (use `1990-01-01` or similar neutral dates as fallbacks)
- Hardcoded absolute paths containing macOS usernames (`/Users/<name>/...`) — use `$HOME`, `~`, or relative paths
- Real email addresses (use `<id>@users.noreply.github.com` pattern for future git config)
- Real weight, body-fat, RHR/HRV/step values as hardcoded test fixtures (use neutral defaults like 75kg, 20%, 60bpm, 50ms, 8000)
- Machine-specific launchd plists, systemd units, or cron files — commit `.template` versions with `{{HOME}}` placeholders and gitignore the real ones
- Personal LAN IPs or hostnames

**Gitignore rules that must stay in place:**
- `public/data/*.json` AND `public/data/profiles/` (nested paths — a shallow glob is NOT enough)
- `public/data/profiles.json` (registry contains age/sex/dataRange per profile)
- `.env` (contains `ANTHROPIC_API_KEY`)
- `scripts/com.quantself.watcher.plist` (machine-specific; `.template` is committed instead)

**When adding a new config/script file:** verify it doesn't bake in machine-specific or personal values. Prefer env vars (`${PYTHON:-python3}`), `$HOME`, or config-file lookups.

## Conventions
- Python interpreter: use the `python3` in your PATH that has pandas and openpyxl installed (anaconda or venv)
- Data inspection: always inspect data structure/format before writing analysis code
- Test files: remove .py test files after successful analysis runs
- Do not create .md files without user approval
- No personal names or personal data values in code/docs/README
- Commit messages: include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- Git author email is configured as `derekyu8090@users.noreply.github.com` — do NOT change to real email
