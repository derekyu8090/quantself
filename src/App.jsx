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
import CorrelationPanel from './components/CorrelationPanel'
import ChatPanel from './components/ChatPanel'
import WeeklyReport from './components/WeeklyReport'
import ErrorBoundary from './components/ErrorBoundary'
import TrendAlerts from './components/TrendAlerts'
import SettingsPanel from './components/SettingsPanel'
import ProfileSelector from './components/ProfileSelector'
import { DateRangeProvider } from './contexts/DateRangeContext'
import { useTranslation } from './i18n'
import './App.css'
import './print.css'

const TAB_IDS = ['cardiovascular', 'sleep', 'activity', 'risk', 'compare', 'ecg', 'correlation', 'glossary']
const TAB_ICONS = { cardiovascular: '♥', sleep: '☾', activity: '⚡', risk: '◉', compare: '⇔', ecg: '♡', correlation: '~', glossary: '?' }

const DATA_FILES = ['cardiovascular', 'sleep', 'activity', 'overview', 'ecg']

// Share mode: hide profile selector, chat, settings when the app is deployed
// for public viewing. Enabled via window.__QUANTSELF_SHARE_MODE__ set in index.html
// or via URL param ?share=1. Stays true for the whole session.
const SHARE_MODE = typeof window !== 'undefined' && (
  window.__QUANTSELF_SHARE_MODE__ === true ||
  new URLSearchParams(window.location.search).get('share') === '1'
)

function App() {
  const [activeTab, setActiveTab] = useState('cardiovascular')
  const [data, setData] = useState({ cardiovascular: null, sleep: null, activity: null, overview: null, ecg: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Profile registry + active profile
  const [profileRegistry, setProfileRegistry] = useState(null)  // { profiles: [], active: '' }
  const [activeProfile, setActiveProfile] = useState(() => {
    if (SHARE_MODE) return null  // will be set from registry.active
    return localStorage.getItem('quantself-active-profile') || 'default'
  })
  const [reloadTrigger, setReloadTrigger] = useState(0)

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

  // Load profile registry once
  useEffect(() => {
    async function loadRegistry() {
      try {
        let registry
        // Inlined registry (standalone HTML build) takes priority
        if (window.__QUANTSELF_REGISTRY__) {
          registry = window.__QUANTSELF_REGISTRY__
        } else if (window.__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core')
          registry = JSON.parse(await invoke('read_health_data', { filename: 'profiles.json', profile: null }))
        } else {
          const r = await fetch('/data/profiles.json')
          if (!r.ok) {
            setProfileRegistry({ profiles: [{ name: 'default', label: 'Me' }], active: 'default' })
            return
          }
          registry = await r.json()
        }
        setProfileRegistry(registry)
        const names = registry.profiles.map(p => p.name)
        if (SHARE_MODE) {
          // Always use registry.active in share mode — ignore localStorage
          setActiveProfile(registry.active || names[0] || 'default')
        } else if (!names.includes(activeProfile)) {
          setActiveProfile(registry.active || names[0] || 'default')
        }
      } catch {
        setProfileRegistry({ profiles: [{ name: 'default', label: 'Me' }], active: 'default' })
      }
    }
    loadRegistry()
  }, [reloadTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active profile
  useEffect(() => {
    localStorage.setItem('quantself-active-profile', activeProfile)
  }, [activeProfile])

  // Data loading — use Tauri command if available, otherwise fetch
  useEffect(() => {
    if (!activeProfile) return  // wait for registry to set it
    let cancelled = false
    setLoading(true)
    setError(null)
    async function loadAllData() {
      try {
        let results
        // Inlined data (standalone HTML build) takes priority
        if (window.__QUANTSELF_DATA__) {
          const d = window.__QUANTSELF_DATA__
          results = DATA_FILES.map(f => d[f])
        } else if (window.__TAURI_INTERNALS__) {
          const { invoke } = await import('@tauri-apps/api/core')
          const load = async (f) => JSON.parse(await invoke('read_health_data', {
            filename: f + '.json',
            profile: activeProfile,
          }))
          results = await Promise.all(DATA_FILES.map(load))
        } else {
          const urls = DATA_FILES.map(f => `/data/profiles/${activeProfile}/${f}.json`)
          const responses = await Promise.all(urls.map(u => fetch(u)))
          for (const r of responses) { if (!r.ok) throw new Error(`Failed (${r.status})`) }
          results = await Promise.all(responses.map(r => r.json()))
        }
        if (!cancelled) {
          const [cardiovascular, sleep, activity, overview, ecg] = results
          setData({ cardiovascular, sleep, activity, overview, ecg })
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          const msg = typeof err === 'string' ? err : (err?.message ?? String(err))
          setError(msg)
          setLoading(false)
        }
      }
    }
    loadAllData()
    return () => { cancelled = true }
  }, [activeProfile, reloadTrigger])

  // Settings modal
  const [showSettings, setShowSettings] = useState(false)

  // Profile deletion
  const handleDeleteProfile = async (profileName) => {
    try {
      if (window.__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('delete_profile', { profile: profileName })
      } else {
        // Web: call a small server endpoint or instruct user
        // For dev, we'll use the chat server's existing HTTP infrastructure
        const res = await fetch(`http://localhost:5180/api/profile/${profileName}`, { method: 'DELETE' })
        if (!res.ok) {
          const msg = await res.text().catch(() => 'Delete failed')
          throw new Error(msg || `HTTP ${res.status}`)
        }
      }
      // If we deleted the active profile, switch to default
      if (activeProfile === profileName) {
        setActiveProfile('default')
      }
      // Reload registry
      setReloadTrigger(n => n + 1)
    } catch (err) {
      alert(`Failed to delete profile: ${err.message}`)
    }
  }

  // CSV export handler
  const handleExportCSV = () => {
    const exportData = (name, rows, headers) => {
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quantself_${name}_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    if (activeTab === 'cardiovascular' && data.cardiovascular?.rhr?.daily) {
      exportData('rhr', data.cardiovascular.rhr.daily, ['date', 'value'])
    } else if (activeTab === 'sleep' && data.sleep?.nightly) {
      exportData('sleep', data.sleep.nightly, ['date', 'total', 'core', 'deep', 'rem', 'bedtime', 'wakeTime'])
    } else if (activeTab === 'activity' && data.activity?.steps?.daily) {
      exportData('steps', data.activity.steps.daily, ['date', 'value'])
    } else if (activeTab === 'risk' && data.overview?.healthScore?.daily) {
      exportData('healthscore', data.overview.healthScore.daily, ['date', 'score', 'rhr', 'hrv', 'sleep', 'activity', 'recovery', 'body', 'daylight'])
    } else {
      const blob = new Blob([JSON.stringify(data.overview, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quantself_overview_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

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
            {/* Profile selector (hidden in share mode) */}
            {!SHARE_MODE && (
              <ProfileSelector
                registry={profileRegistry}
                active={activeProfile}
                onChange={setActiveProfile}
                onDelete={handleDeleteProfile}
                t={t}
              />
            )}

            {/* Export PDF */}
            <button className="export-btn print-hide" onClick={() => window.print()}>
              {t?.('app.export') ?? 'Export PDF'}
            </button>

            {/* Export CSV */}
            <button className="export-btn print-hide" onClick={handleExportCSV}>
              {t?.('app.exportCSV') ?? 'Export CSV'}
            </button>

            {/* Settings (hidden in share mode) */}
            {!SHARE_MODE && (
              <button className="export-btn print-hide" onClick={() => setShowSettings(true)}>
                {t?.('settings.title') ?? 'Settings'}
              </button>
            )}

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
              <ErrorBoundary name="Health Score">
                <HealthScoreCard data={data.overview.healthScore} t={t} />
              </ErrorBoundary>
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <ErrorBoundary name="Longevity Score">
                <LongevityScoreCard data={data.overview?.longevityScore} t={t} />
              </ErrorBoundary>
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <ErrorBoundary name="Baseline Alerts">
                <BaselineAlerts baselines={data.overview.baselines} t={t} />
              </ErrorBoundary>
            </div>
          </div>
        )}

        {!loading && !error && data.overview?.trends?.length > 0 && (
          <ErrorBoundary name="Trend Alerts">
            <TrendAlerts trends={data.overview.trends} t={t} />
          </ErrorBoundary>
        )}

        {!loading && !error && data.overview?.weeklyReport && (
          <ErrorBoundary name="Weekly Report">
            <WeeklyReport data={data.overview.weeklyReport} t={t} />
          </ErrorBoundary>
        )}

        {!loading && !error && (
          <>
            <div id="panel-cardiovascular" role="tabpanel" aria-labelledby="tab-cardiovascular"
                 hidden={activeTab !== 'cardiovascular'}>
              {activeTab === 'cardiovascular' && (
                <ErrorBoundary name="Cardiovascular">
                  <CardiovascularPanel
                    key={theme}
                    data={data.cardiovascular}
                    overview={data.overview}
                    workouts={data.activity?.workouts}
                    sleepNightly={data.sleep?.nightly}
                    t={t}
                  />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-sleep" role="tabpanel" aria-labelledby="tab-sleep"
                 hidden={activeTab !== 'sleep'}>
              {activeTab === 'sleep' && (
                <ErrorBoundary name="Sleep">
                  <SleepPanel key={theme} data={data.sleep} t={t} />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity"
                 hidden={activeTab !== 'activity'}>
              {activeTab === 'activity' && (
                <ErrorBoundary name="Activity">
                  <ActivityPanel key={theme} data={data.activity} t={t} />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-risk" role="tabpanel" aria-labelledby="tab-risk"
                 hidden={activeTab !== 'risk'}>
              {activeTab === 'risk' && (
                <ErrorBoundary name="Risk & Goals">
                  <RiskPanel key={theme} overview={data.overview} t={t} />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-compare" role="tabpanel" aria-labelledby="tab-compare"
                 hidden={activeTab !== 'compare'}>
              {activeTab === 'compare' && (
                <ErrorBoundary name="Compare">
                  <ComparisonView
                    key={theme}
                    cardiovascular={data.cardiovascular}
                    sleep={data.sleep}
                    activity={data.activity}
                    t={t}
                  />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-ecg" role="tabpanel" aria-labelledby="tab-ecg"
                 hidden={activeTab !== 'ecg'}>
              {activeTab === 'ecg' && (
                <ErrorBoundary name="ECG">
                  <ECGPanel data={data.ecg} t={t} />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-correlation" role="tabpanel" aria-labelledby="tab-correlation"
                 hidden={activeTab !== 'correlation'}>
              {activeTab === 'correlation' && (
                <ErrorBoundary name="Insights">
                  <CorrelationPanel data={data.overview?.correlations} t={t} />
                </ErrorBoundary>
              )}
            </div>

            <div id="panel-glossary" role="tabpanel" aria-labelledby="tab-glossary"
                 hidden={activeTab !== 'glossary'}>
              {activeTab === 'glossary' && (
                <ErrorBoundary name="Glossary">
                  <GlossaryPanel t={t} />
                </ErrorBoundary>
              )}
            </div>
          </>
        )}
      </main>

      {!SHARE_MODE && (
        <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} t={t} />
      )}
      {!SHARE_MODE && !loading && !error && <ChatPanel t={t} />}
    </div>
    </DateRangeProvider>
  )
}

export default App
