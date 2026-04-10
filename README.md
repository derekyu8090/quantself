# HealthDash

A personal health dashboard that visualizes Apple Health data with interactive charts, risk assessment, and goal tracking.

Built with React + Recharts. Supports light/dark mode and English/Chinese.

## Features

- **Cardiovascular** -- Resting heart rate, HRV (SDNN), VO2 Max trends, 24-hour heart rate profile, SpO2
- **Sleep** -- Duration by stage (core/deep/REM), bedtime trend, bedtime heatmap, circadian rhythm analysis
- **Activity** -- Daily steps, workout frequency, body weight trend, swimming analysis with HR zones
- **Risk & Goals** -- Six-dimension risk scoring, 2W/4W goal tracking, anomaly event timeline
- **Glossary** -- Plain-language explanations of each health metric with normal ranges and improvement strategies

## Prerequisites

- Node.js >= 18
- Python 3.8+ (for data pipeline)
- Apple Health export (from iPhone: Health app > Profile > Export All Health Data)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/health-dashboard.git
cd health-dashboard
npm install

# 2. Process your Apple Health data
python3 process_data.py /path/to/apple_health_export

# 3. Start the dashboard
npm run dev
```

Open http://localhost:5173 in your browser.

## Updating Data

When you export new data from Apple Health:

```bash
python3 process_data.py /path/to/new_apple_health_export
```

Refresh the browser. The JSON data files in `public/data/` are regenerated from the full XML export.

## Project Structure

```
health-dashboard/
  process_data.py              # Data pipeline: Apple Health XML -> JSON
  public/data/                 # Generated JSON (gitignored, contains personal data)
    cardiovascular.json
    sleep.json
    activity.json
    overview.json
  src/
    App.jsx                    # Main app shell with tabs, theme, language
    i18n.js                    # English/Chinese translations
    chartTheme.js              # Shared Recharts styling (adapts to light/dark)
    index.css                  # Design tokens (light/dark color system)
    App.css                    # Layout and component styles
    components/
      CardiovascularPanel.jsx  # Heart rate, HRV, VO2Max, SpO2
      SleepPanel.jsx           # Sleep duration, stages, bedtime analysis
      ActivityPanel.jsx        # Steps, workouts, body composition
      RiskPanel.jsx            # Risk scores, goals, anomalies
      GlossaryPanel.jsx        # Metric explanations
      StatCard.jsx             # Reusable stat card
      ChartTooltip.jsx         # Shared chart tooltip
```

## Data Pipeline

`process_data.py` uses streaming XML parsing to handle large exports (1GB+). It extracts:

| Source Record Type | Output |
|---|---|
| HeartRate, RestingHeartRate, HeartRateVariabilitySDNN | cardiovascular.json |
| SleepAnalysis (Core/Deep/REM) | sleep.json |
| StepCount, ActiveEnergyBurned, Workout | activity.json |
| VO2Max, BodyMass, BodyFatPercentage | overview.json |

Processing a 1.2GB export takes approximately 2 minutes on an M1 Mac.

## Privacy

Your health data never leaves your machine. The JSON files in `public/data/` are gitignored by default. The dashboard runs entirely locally with no external API calls.

## Tech Stack

- [React](https://react.dev) -- UI framework
- [Recharts](https://recharts.org) -- Chart library
- [Vite](https://vite.dev) -- Build tool
- Python standard library -- XML parsing (no dependencies)

## License

MIT
