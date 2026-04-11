import { useState, useEffect } from 'react'
import CardiovascularPanel from './components/CardiovascularPanel'
import SleepPanel from './components/SleepPanel'
import ActivityPanel from './components/ActivityPanel'
import RiskPanel from './components/RiskPanel'
import GlossaryPanel from './components/GlossaryPanel'
import ComparisonView from './components/ComparisonView'
import DateRangePicker from './components/DateRangePicker'
import HealthScoreCard from './components/HealthScoreCard'
import LongevityScoreCard from './components/LongevityScoreCard'
import BaselineAlerts from './components/BaselineAlerts'
import ECGPanel from './components/ECGPanel'
import { DateRangeProvider } from './contexts/DateRangeContext'
import { useTranslation } from './i18n'
import './App.css'
import './print.css'

const TAB_IDS = ['cardiovascular', 'sleep', 'activity', 'risk', 'compare', 'ecg', 'glossary']
const TAB_ICONS = { cardiovascular: '♥', sleep: '☾', activity: '⚡', risk: '◉', compare: '⇔', ecg: '♡', glossary: '?' }

const DATA_URLS = {
  cardiovascular: '/data/cardiovascular.json',
  sleep:          '/data/sleep.json',
  activity:       '/data/activity.json',
  overview:       '/data/overview.json',
  ecg:            '/data/ecg.json',
}

function App() {
  const [activeTab, setActiveTab] = useState('cardiovascular')
  const [data, setData] = useState({ cardiovascular: null, sleep: null, activity: null, overview: null, ecg: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Theme
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('health-dash-theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('health-dash-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  // Language
  const [lang, setLang] = useState(() => localStorage.getItem('health-dash-lang') || 'zh')
  const { t } = useTranslation(lang)

  useEffect(() => {
    localStorage.setItem('health-dash-lang', lang)
  }, [lang])

  const toggleLang = () => setLang(l => l === 'zh' ? 'en' : 'zh')

  // Data loading — use Tauri command if available, otherwise fetch
  useEffect(() => {
    let cancelled = false
    async function loadAllData() {
      try {
        let cardiovascular, sleep, activity, overview, ecg
        if (window.__TAURI_INTERNALS__) {
          // Running inside Tauri — read from ~/health-dashboard/public/data/
          const { invoke } = await import('@tauri-apps/api/core')
          const load = async (f) => JSON.parse(await invoke('read_health_data', { filename: f }))
          ;[cardiovascular, sleep, activity, overview, ecg] = await Promise.all([
            load('cardiovascular.json'), load('sleep.json'), load('activity.json'),
            load('overview.json'), load('ecg.json'),
          ])
        } else {
          // Running in browser — fetch from dev server
          const responses = await Promise.all(Object.values(DATA_URLS).map(u => fetch(u)))
          for (const r of responses) { if (!r.ok) throw new Error(`Failed (${r.status})`) }
          ;[cardiovascular, sleep, activity, overview, ecg] = await Promise.all(responses.map(r => r.json()))
        }
        if (!cancelled) { setData({ cardiovascular, sleep, activity, overview, ecg }); setLoading(false) }
      } catch (err) {
        if (!cancelled) { setError(err.message ?? 'Unknown error'); setLoading(false) }
      }
    }
    loadAllData()
    return () => { cancelled = true }
  }, [])

  const dataRange = data.overview?.dataRange
  const dataRangeLabel = dataRange ? `${dataRange.start} \u2013 ${dataRange.end}` : null

  return (
    <DateRangeProvider>
    <div className="app">
      <header className="app-header" role="banner">
        <div className="app-header-inner">
          <div className="app-logo">
            <div className="app-logo-icon" aria-hidden="true">♥</div>
            <div>
              <span className="app-logo-text">{t('app.title')}</span>
              <span className="app-logo-sub">{t('app.subtitle')}</span>
            </div>
          </div>

          <div className="header-divider" aria-hidden="true" />

          <nav className="tab-nav" role="tablist" aria-label="Dashboard sections">
            {TAB_IDS.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                className={`tab-btn${activeTab === id ? ' active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <span className="tab-icon" aria-hidden="true">{TAB_ICONS[id]}</span>
                <span className="tab-label">{t(`tabs.${id}`)}</span>
              </button>
            ))}
          </nav>

          <DateRangePicker lang={lang} />

          <div className="header-meta">
            {/* Export PDF */}
            <button className="export-btn print-hide" onClick={() => window.print()}>
              {t?.('app.export') ?? 'Export PDF'}
            </button>

            {/* Language toggle */}
            <button className="lang-toggle" onClick={toggleLang} aria-label="Switch language">
              <span className={`lang-opt${lang === 'en' ? ' active' : ''}`}>EN</span>
              <span className="lang-sep">/</span>
              <span className={`lang-opt${lang === 'zh' ? ' active' : ''}`}>中</span>
            </button>

            {/* Theme toggle */}
            <button className="theme-toggle" onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <span className="theme-toggle-track">
                <span className="theme-toggle-icon theme-toggle-moon">☽</span>
                <span className="theme-toggle-icon theme-toggle-sun">☀</span>
                <span className="theme-toggle-thumb" />
              </span>
            </button>

            {!loading && !error && dataRangeLabel && (
              <span className="data-range-badge">{dataRangeLabel}</span>
            )}
            {loading && <span className="loading-dot" title="Loading" aria-label="Loading" />}
          </div>
        </div>
      </header>

      <main className="app-main" id="main-content">
        {loading && (
          <div className="state-container" role="status" aria-live="polite">
            <div className="loading-spinner" aria-hidden="true" />
            <span className="state-title">{t('app.loading')}</span>
            <span className="state-sub">{t('app.loadingSub')}</span>
          </div>
        )}

        {error && (
          <div className="state-container" role="alert">
            <span className="error-icon" aria-hidden="true">&#9888;</span>
            <span className="state-title">{t('app.errorTitle')}</span>
            <span className="state-sub">{error}</span>
          </div>
        )}

        {!loading && !error && data.overview && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px' }}>
              <HealthScoreCard data={data.overview.healthScore} t={t} />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <LongevityScoreCard data={data.overview?.longevityScore} t={t} />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <BaselineAlerts baselines={data.overview.baselines} t={t} />
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div id="panel-cardiovascular" role="tabpanel" aria-labelledby="tab-cardiovascular"
                 hidden={activeTab !== 'cardiovascular'}>
              {activeTab === 'cardiovascular' && (
                <CardiovascularPanel
                  key={theme}
                  data={data.cardiovascular}
                  overview={data.overview}
                  workouts={data.activity?.workouts}
                  sleepNightly={data.sleep?.nightly}
                  t={t}
                />
              )}
            </div>

            <div id="panel-sleep" role="tabpanel" aria-labelledby="tab-sleep"
                 hidden={activeTab !== 'sleep'}>
              {activeTab === 'sleep' && (
                <SleepPanel key={theme} data={data.sleep} t={t} />
              )}
            </div>

            <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity"
                 hidden={activeTab !== 'activity'}>
              {activeTab === 'activity' && (
                <ActivityPanel key={theme} data={data.activity} t={t} />
              )}
            </div>

            <div id="panel-risk" role="tabpanel" aria-labelledby="tab-risk"
                 hidden={activeTab !== 'risk'}>
              {activeTab === 'risk' && (
                <RiskPanel key={theme} overview={data.overview} t={t} />
              )}
            </div>

            <div id="panel-compare" role="tabpanel" aria-labelledby="tab-compare"
                 hidden={activeTab !== 'compare'}>
              {activeTab === 'compare' && (
                <ComparisonView
                  key={theme}
                  cardiovascular={data.cardiovascular}
                  sleep={data.sleep}
                  activity={data.activity}
                  t={t}
                />
              )}
            </div>

            <div id="panel-ecg" role="tabpanel" aria-labelledby="tab-ecg"
                 hidden={activeTab !== 'ecg'}>
              {activeTab === 'ecg' && <ECGPanel data={data.ecg} t={t} />}
            </div>

            <div id="panel-glossary" role="tabpanel" aria-labelledby="tab-glossary"
                 hidden={activeTab !== 'glossary'}>
              {activeTab === 'glossary' && (
                <GlossaryPanel t={t} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
    </DateRangeProvider>
  )
}

export default App
