<div align="right">

[中文](README_ZH.md) | English

</div>

<div align="center">

# QuantSelf

**Open-source personal health dashboard powered by Apple Health data.**

Evidence-based health scoring | Interactive charts | macOS desktop app | Privacy-first

[Features](#features) | [Quick Start](#quick-start) | [Architecture](#architecture) | [Roadmap](#roadmap)

---

</div>

## What is QuantSelf?

QuantSelf turns your Apple Health export into an interactive, research-backed health dashboard. It computes two composite health scores, visualizes 20+ metrics across 8 panels, and runs entirely on your machine -- your data never leaves your computer.

```
iPhone Health Export --> Python Pipeline --> JSON Data --> React Dashboard / Tauri Desktop App
```

## Features

### 8 Interactive Panels

| Panel | Metrics | Highlights |
|-------|---------|------------|
| **Cardiovascular** | RHR, HRV, VO2Max, SpO2, Walking HR | 24-hour heart rate profile, respiratory rate trend |
| **Sleep** | Duration, Core/Deep/REM stages, Bedtime | Bedtime heatmap, breathing disturbance index, wrist temperature |
| **Activity** | Steps, Exercise time, Stand hours, Workouts | Swimming HR zone analysis, GitHub-style calendar heatmap |
| **Risk & Goals** | 6-dimension risk assessment, Goal tracking | Dynamic risk scores computed from actual data, anomaly timeline |
| **Compare** | Period comparison (any two time ranges) | Side-by-side StatCards with delta, overlaid trend charts |
| **ECG** | 24 electrocardiogram recordings | Waveform visualization with Apple classification badges |
| **Glossary** | 8 core health metrics explained | What it is, normal range, why it matters, how to improve |
| **Exercise Recovery** | Workout vs next-day HRV/RHR | Duration-vs-recovery scatter plot, recovery timeline |

### Two Composite Health Scores

**Daily Health Score (0-100)** -- How are you today?
- Weighted from: Sleep (25%) + HRV (20%) + RHR (15%) + Activity (15%) + Recovery (15%) + Body (10%)
- Updates daily, sensitive to yesterday's sleep and today's activity

**Longevity Score (0-100)** -- Long-term health trajectory
- Evidence-based, weighted by meta-analysis effect sizes:

| Component | Weight | Key Reference |
|-----------|--------|---------------|
| VO2Max | 25% | Kodama 2009, JAMA -- 13% mortality reduction per MET |
| Sleep Regularity | 20% | Windred 2024, Sleep -- SRI stronger than duration |
| Activity Level | 20% | Paluch 2022, Lancet -- 8000 steps = 45% reduction |
| HRV | 15% | Hillebrand 2013, Europace -- SDNN predicts CVD |
| Body Composition | 10% | Jayedi 2022, Int J Obes -- J-shaped curve |
| SpO2 | 5% | Yan 2024, J Clin Sleep Med -- nocturnal SpO2 |
| Resting HR | 5% | Aune 2017 -- 9% per 10bpm |

### Additional Features

- **Light / Dark mode** -- Premium minimal design with smooth theme transition
- **English / Chinese** -- Full bilingual interface
- **Date range filtering** -- All Time, 30d, 90d, 6m, 1y, or custom range
- **Baseline alerts** -- Personal 30-day rolling baselines with sigma deviation detection
- **Achievement system** -- Exercise/sleep/step streaks and personal records
- **PDF export** -- One-click print-optimized report
- **Calendar heatmaps** -- GitHub contribution-graph style for sleep and steps
- **macOS desktop app** -- 12MB native Tauri app with system tray
- **iCloud auto-sync** -- fswatch monitors for new exports, auto-updates dashboard

## Architecture

```
                    +------------------+
                    |   iPhone Health   |
                    |   (manual export) |
                    +--------+---------+
                             |
                    export.xml (1GB+)
                             |
                    +--------v---------+
                    |  process_data.py |  <-- Streaming XML parser
                    |  (Python, no deps)|     Handles 3M+ records
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     cardiovascular.json  sleep.json   activity.json
              |              |              |
              +------+-------+------+-------+
                     |              |
                overview.json    ecg.json
                     |
     +---------------+---------------+
     |               |               |
  Health Score   Longevity Score   Risk Scores
  (daily 0-100)  (monthly 0-100)  (6 dimensions)
                     |
              +------v------+
              |   React UI  |  <-- Recharts, CSS variables
              |  (Vite SPA) |     Light/dark, EN/ZH
              +------+------+
                     |
         +-----------+-----------+
         |                       |
    localhost:5173          Tauri Desktop
    (npm run dev)          (12MB .app)
```

### Data Flow

```
Apple Health XML
  |
  |-- HeartRate (1M+ records)        --> cardiovascular.json
  |-- RestingHeartRate                   |-- rhr (daily + monthly)
  |-- HeartRateVariabilitySDNN           |-- hrv (daily + night/day split)
  |-- VO2Max                             |-- vo2max (records + stats)
  |-- OxygenSaturation                   |-- spo2 (hourly profile)
  |-- RespiratoryRate                    |-- respiratory (monthly)
  |-- WalkingHeartRateAverage            |-- walkingHR (monthly)
  |                                      |-- hrHourly (24h profile)
  |
  |-- SleepAnalysis (29K records)    --> sleep.json
  |     Core / Deep / REM / Awake        |-- nightly (per-night breakdown)
  |                                      |-- monthly (averages)
  |                                      |-- heatmap (bedtime distribution)
  |                                      |-- breathingDisturbances
  |                                      |-- wristTemperature
  |
  |-- StepCount                      --> activity.json
  |-- ActiveEnergyBurned                 |-- steps (daily + monthly)
  |-- Workout (Swimming, Cycling...)     |-- workouts (with HR stats)
  |-- BodyMass / BodyFatPercentage       |-- bodyMass / bodyFat
  |-- AppleExerciseTime                  |-- exerciseTime
  |
  |-- Electrocardiograms (24 CSVs)   --> ecg.json
  |     512Hz Lead I recordings          |-- downsampled waveforms
  |
  +-- Computed fields                --> overview.json
        |-- healthScore (daily 0-100, 6 components)
        |-- longevityScore (0-100, 7 evidence-based components)
        |-- risks (6 dimensions, dynamically computed)
        |-- goals (personalized targets)
        |-- baselines (30-day rolling mean/stddev)
        |-- anomalies (5 types: RHR, HRV, sleep, bedtime, SpO2)
```

## Quick Start

### Option 1: Web Dashboard (simplest)

```bash
git clone https://github.com/derekyu8090/quantself.git
cd quantself
npm install

# Process your Apple Health data
python3 process_data.py /path/to/apple_health_export

# Start the dashboard
npm run dev
```

Open http://localhost:5173.

### Option 2: macOS Desktop App

Requires Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).

```bash
# Build the native app
npx tauri build

# Install to Applications
cp -r src-tauri/target/release/bundle/macos/QuantSelf.app /Applications/
```

### Option 3: Auto-Sync with iCloud

```bash
brew install fswatch

# Install the background watcher
cp scripts/com.quantself.watcher.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.quantself.watcher.plist
```

Then on iPhone: Health app > Profile > Export > Save to iCloud Drive > `HealthExport` folder. Mac auto-detects and updates.

## Updating Data

```bash
python3 process_data.py /path/to/new_apple_health_export
```

Or if using Claude Code with the skill installed:

```
/health-update /path/to/apple_health_export
```

## Project Structure

```
quantself/
  process_data.py                  # Data pipeline (XML -> JSON, no dependencies)
  public/data/                     # Generated health data (gitignored)
  scripts/
    health-watcher.sh              # iCloud auto-sync daemon
    com.quantself.watcher.plist    # launchd service config
  src/
    App.jsx                        # Main shell (tabs, theme, language, data loading)
    i18n.js                        # EN/ZH translations
    chartTheme.js                  # Recharts theme (adapts to light/dark)
    index.css                      # Design tokens
    print.css                      # PDF export styles
    utils/
      dataUtils.js                 # Shared date/stats utilities
    contexts/
      DateRangeContext.jsx          # Global date range filter
    components/
      CardiovascularPanel.jsx      # Heart rate, HRV, VO2Max, SpO2, respiratory
      SleepPanel.jsx               # Sleep stages, bedtime, breathing, temperature
      ActivityPanel.jsx            # Steps, workouts, exercise time, achievements
      RiskPanel.jsx                # Risk scores, goals, anomalies
      ComparisonView.jsx           # Period comparison
      ECGPanel.jsx                 # ECG waveform viewer
      GlossaryPanel.jsx            # Metric explanations
      HealthScoreCard.jsx          # Daily health score gauge
      LongevityScoreCard.jsx       # Long-term score with references
      BaselineAlerts.jsx           # Deviation alerts
      ExerciseRecoveryChart.jsx    # Workout recovery analysis
      CalendarHeatmap.jsx          # GitHub-style heatmap
      AchievementBadges.jsx        # Streaks and records
      StatCard.jsx                 # Reusable metric card
      ChartTooltip.jsx             # Shared tooltip
      DateRangePicker.jsx          # Time range selector
  src-tauri/                        # Tauri desktop app (Rust)
    src/lib.rs                     # System tray, window management
    tauri.conf.json                # App config, bundling
```

## Roadmap

### Completed

- [x] **v1.0** -- Core dashboard: 5 panels, light/dark mode, EN/ZH
- [x] **v1.1** -- Date range filter, 6 new charts, dynamic risk scores, 5-type anomaly detection
- [x] **v1.2** -- Daily health score, baseline alerts, period comparison, exercise-recovery analysis
- [x] **v1.3** -- Evidence-based longevity score, calendar heatmaps, ECG viewer, achievements, PDF export
- [x] **v1.4** -- Tauri macOS desktop app (12MB), iCloud auto-sync with fswatch

### Planned

- [ ] **v2.0** -- iOS app with direct HealthKit access (Capacitor), AI weekly reports (Claude API), multi-source support (Garmin, Fitbit)

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + Recharts 3 | Interactive charts and UI |
| Styling | CSS Variables | Light/dark theming, no CSS framework |
| Build | Vite 8 | Fast HMR development |
| Desktop | Tauri 2.10 (Rust) | Native macOS app, 12MB bundle |
| Data Pipeline | Python (stdlib only) | Streaming XML parser, no dependencies |
| Auto-Sync | fswatch + launchd | Background file monitoring |

## Privacy

- All data stays on your machine. No cloud, no telemetry, no external API calls.
- `public/data/*.json` is gitignored -- your health data is never committed.
- The Tauri app uses the system WebView -- no Chromium bundled, no data collection.

## Data Pipeline Performance

| Export Size | Records | Processing Time (M3 Max) |
|-------------|---------|--------------------------|
| 500 MB | ~1.5M | ~1 min |
| 1.2 GB | ~3M | ~2 min |
| 2 GB+ | ~5M | ~3-4 min |

## Contributing

Contributions welcome. See the [roadmap](#roadmap) for planned features. Key areas:

- **Data source adapters** -- Garmin, Fitbit, Samsung Health parsers
- **New visualizations** -- correlation discovery, predictive models
- **Mobile** -- Capacitor iOS/Android with HealthKit/Health Connect
- **Localization** -- additional language support

## References

The Longevity Score methodology is based on these peer-reviewed studies:

1. Kodama S et al. Cardiorespiratory fitness as a quantitative predictor of all-cause mortality. *JAMA*. 2009;301(19):2024-2035.
2. Mandsager K et al. Association of CRF with long-term mortality. *JAMA Netw Open*. 2018;1(6):e183605.
3. Windred DP et al. Sleep regularity is a stronger predictor of mortality risk than sleep duration. *Sleep*. 2024;47(1):zsad253.
4. Paluch AE et al. Daily steps and all-cause mortality: a meta-analysis. *Lancet Public Health*. 2022;7(3):e219-e228.
5. Hillebrand S et al. Heart rate variability and first cardiovascular event. *Europace*. 2013;15(5):742-749.
6. Jayedi A et al. Body fat and risk of all-cause mortality. *Int J Obes*. 2022;46(9):1573-1581.
7. Yan B et al. Nocturnal oxygen saturation and all-cause mortality. *J Clin Sleep Med*. 2024;20(2):229-235.
8. Lloyd-Jones DM et al. Life's Essential 8. *Circulation*. 2022;146(5):e18-e43.

## License

MIT
