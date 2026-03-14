import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Shield, Terminal, Target, Database, FileSearch, Trash2, Play, Download, XCircle } from 'lucide-react'
import clsx from 'clsx'
import './styles.css'
import './styles/layouts/compact.css'
import './styles/layouts/classic.css'
import './styles/layouts/modern.css'
import './styles/layouts/matrix.css'
import './styles/layouts/midnight.css'
import './styles/layouts/black-lantern.css'
import './styles/themes/dark.css'
import './styles/themes/light.css'
import './styles/themes/matrix.css'
import './styles/themes/midnight.css'
import './styles/themes/black-lantern.css'
import './styles/layouts/shared.css'

const DEFAULT_EVENT_TYPES = [
  'ASN',
  'AZURE_TENANT',
  'CODE_REPOSITORY',
  'DNS_NAME',
  'DNS_NAME_UNRESOLVED',
  'EMAIL_ADDRESS',
  'FILESYSTEM',
  'FINDING',
  'GEOLOCATION',
  'HASHED_PASSWORD',
  'HTTP_RESPONSE',
  'IP_ADDRESS',
  'IP_RANGE',
  'MOBILE_APP',
  'OPEN_TCP_PORT',
  'ORG_STUB',
  'PASSWORD',
  'PROTOCOL',
  'RAW_DNS_RECORD',
  'RAW_TEXT',
  'SOCIAL',
  'STORAGE_BUCKET',
  'TECHNOLOGY',
  'URL',
  'URL_HINT',
  'URL_UNVERIFIED',
  'USERNAME',
  'VHOST',
  'VULNERABILITY',
  'WAF',
  'WEBSCREENSHOT',
  'WEB_PARAMETER'
]

const DEFAULT_ENVIRONMENT_STATE = {
  hostConfigured: null,
  hostError: '',
  bbotInstalled: false,
  bbotPath: '',
  installedVersion: '',
  latestVersion: '',
  updateAvailable: false,
  status: 'checking',
  message: 'Checking BBOT status...',
  capabilitiesLoaded: false,
  presets: [],
  flags: [],
  eventTypes: DEFAULT_EVENT_TYPES
}

const MODULE_DEP_OPTIONS = [
  { value: '--ignore-failed-deps', label: 'Ignore Failed Deps' },
  { value: '--no-deps', label: "Don't install deps." },
  { value: '--force-deps', label: 'Force' },
  { value: '--retry-deps', label: 'Retry Deps' },
  { value: '--install-all-deps', label: 'Install All' }
]

function parseListInput(value) {
  return [...new Set(String(value || '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean))]
}

function appendListValue(currentValue, nextValue) {
  const value = String(nextValue || '').trim()
  if (!value) {
    return currentValue
  }

  const existingValues = parseListInput(currentValue)
  if (existingValues.includes(value)) {
    return currentValue
  }

  return existingValues.length === 0 ? value : `${existingValues.join('\n')}\n${value}`
}

function App() {
  const [target, setTarget] = useState('')
  const [scanResults, setScanResults] = useState('')
  const [urlsOutput, setUrlsOutput] = useState('')
  const [outfilesOutput, setOutfilesOutput] = useState('')
  const [subdomainsOutput, setSubdomainsOutput] = useState('')
  const [hosts, setHosts] = useState('')
  const [currentLayout, setCurrentLayout] = useState('default')
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('default')
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)
  const [isTargetsCollapsed, setIsTargetsCollapsed] = useState(false)
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false)
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(true)
  const [isActionsCollapsed, setIsActionsCollapsed] = useState(true)
  const [outputIcon, setOutputIcon] = useState('bls_icon_light.png')
  const [isStreaming, setIsStreaming] = useState(true)
  const [activeTab, setActiveTab] = useState('raw')
  const [recentDomains, setRecentDomains] = useState([])
  const [subdomainFiles, setSubdomainFiles] = useState([])
  const [zoom, setZoom] = useState(1)
  const [environmentState, setEnvironmentState] = useState(DEFAULT_ENVIRONMENT_STATE)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [selectedEventType, setSelectedEventType] = useState('*')
  const [selectedFlag, setSelectedFlag] = useState('')
  const [moduleDep, setModuleDep] = useState('--ignore-failed-deps')
  const [allowDeadly, setAllowDeadly] = useState(false)
  const [useBurp, setUseBurp] = useState(false)
  const [viewPreset, setViewPreset] = useState(false)
  const [strictScope, setStrictScope] = useState(false)
  const [whitelistTargets, setWhitelistTargets] = useState('')
  const [blacklistTargets, setBlacklistTargets] = useState('')

  const applyEnvironmentState = useCallback((data) => {
    if (!data) {
      return
    }

    setEnvironmentState((previous) => ({
      ...previous,
      ...data,
      presets: Array.isArray(data.presets) ? data.presets : previous.presets,
      flags: Array.isArray(data.flags) ? data.flags : previous.flags,
      eventTypes: Array.isArray(data.eventTypes) && data.eventTypes.length > 0 ? data.eventTypes : previous.eventTypes
    }))
  }, [])

  const handleZoom = useCallback((delta) => {
    setZoom((previous) => Math.min(Math.max(previous + delta, 0.5), 2))
  }, [])

  const sendMessage = useCallback((type, additionalData = {}) => {
    if (typeof browser === 'undefined' || !browser.runtime) {
      return Promise.resolve(null)
    }
    return browser.runtime.sendMessage({ type, ...additionalData }).catch(() => null)
  }, [])

  useEffect(() => {
    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault()
        const delta = event.deltaY > 0 ? -0.1 : 0.1
        handleZoom(delta)
      }
    }

    const handleKeyboard = (event) => {
      if (event.ctrlKey) {
        if (event.key === '=' || event.key === '+') {
          event.preventDefault()
          handleZoom(0.1)
        } else if (event.key === '-') {
          event.preventDefault()
          handleZoom(-0.1)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyboard)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyboard)
    }
  }, [handleZoom])

  useEffect(() => {
    document.documentElement.style.setProperty('--zoom-level', zoom)
  }, [zoom])

  useEffect(() => {
    const fetchRecentDomains = async () => {
      try {
        if (typeof browser !== 'undefined' && browser.history) {
          const historyItems = await browser.history.search({ text: '', maxResults: 15 })
          const uniqueDomains = new Set()
          historyItems.forEach((item) => {
            try {
              const urlObject = new URL(item.url)
              uniqueDomains.add(urlObject.hostname)
            } catch (error) {
              console.error('Invalid URL:', item.url)
            }
          })
          setRecentDomains([...uniqueDomains])
        }
      } catch (error) {
        console.error('Error fetching history:', error)
      }
    }

    fetchRecentDomains()
  }, [])

  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      browser.storage.local.get(['lastScan']).then((result) => {
        if (result.lastScan) {
          setScanResults(result.lastScan)
        }
      }).catch((error) => {
        console.error('Failed to access browser.storage.local:', error)
      })
    }

    if (typeof browser === 'undefined' || !browser.runtime) {
      return undefined
    }

    const listener = (message) => {
      if (message.type === 'updateOutput') {
        setScanResults(message.data)
      } else if (message.type === 'updateURLs') {
        setUrlsOutput(message.data)
      } else if (message.type === 'updateOutfiles') {
        setOutfilesOutput(message.data)
        const outfiles = message.data.split('\n').filter((line) => line && !line.startsWith('Extracted Outfile:'))
        setSubdomainFiles(outfiles)
      } else if (message.type === 'updateSubdomains') {
        setSubdomainsOutput(message.data)
      } else if (message.type === 'updateHosts') {
        setHosts(message.data)
      } else if (message.type === 'environmentStateUpdated') {
        applyEnvironmentState(message.data)
      }
    }

    browser.runtime.onMessage.addListener(listener)

    browser.runtime.sendMessage({ type: 'getEnvironmentState' }).then((state) => {
      applyEnvironmentState(state)
    }).catch(() => {})

    browser.runtime.sendMessage({ type: 'refreshEnvironmentState' }).then((state) => {
      applyEnvironmentState(state)
    }).catch(() => {})

    browser.runtime.sendMessage({ type: 'getOutfile' }).catch(() => {})

    return () => {
      browser.runtime.onMessage.removeListener?.(listener)
    }
  }, [applyEnvironmentState])

  useEffect(() => {
    if (environmentState.presets.length > 0 && !environmentState.presets.includes(selectedPreset)) {
      setSelectedPreset(environmentState.presets[0])
    }
  }, [environmentState.presets, selectedPreset])

  useEffect(() => {
    if (selectedFlag && !environmentState.flags.includes(selectedFlag)) {
      setSelectedFlag('')
    }
  }, [environmentState.flags, selectedFlag])

  useEffect(() => {
    if (selectedEventType !== '*' && !environmentState.eventTypes.includes(selectedEventType)) {
      setSelectedEventType('*')
    }
  }, [environmentState.eventTypes, selectedEventType])

  const handleDeploy = () => {
    if (!environmentState.hostConfigured) {
      setScanResults(environmentState.message || 'Native host is not configured.')
      return
    }

    sendMessage('deployBbot')
    setScanResults(environmentState.updateAvailable ? 'Updating BBOT...' : 'Deploying BBOT...')
  }

  const handleThemeChange = (theme) => {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-matrix', 'theme-midnight', 'theme-black-lantern')
    if (theme !== 'default') {
      document.body.classList.add(`theme-${theme}`)
      if (currentLayout === 'black-lantern') {
        setOutputIcon(theme === 'light' ? '/assets/logos/bls_icon_dark.png' : '/assets/logos/bls_icon_light.png')
      }
    }
    setCurrentTheme(theme)
    setShowThemeMenu(false)
  }

  const handleLayoutChange = (layout) => {
    document.body.classList.remove('layout-compact', 'layout-classic', 'layout-modern', 'layout-matrix', 'layout-midnight', 'layout-black-lantern')
    if (layout !== 'default') {
      document.body.classList.add(`layout-${layout}`)
      if (layout === 'black-lantern') {
        setOutputIcon(currentTheme === 'light' ? '/assets/logos/bls_icon_dark.png' : '/assets/logos/bls_icon_light.png')
      }
    }
    setCurrentLayout(layout)
    setShowThemeMenu(false)
  }

  const handleScan = () => {
    const parsedTargets = parseListInput(target)
    const parsedWhitelist = parseListInput(whitelistTargets)
    const parsedBlacklist = parseListInput(blacklistTargets)

    if (!environmentState.hostConfigured) {
      setScanResults(environmentState.message || 'Native host is not configured.')
      return
    }

    if (!environmentState.bbotInstalled) {
      setScanResults('BBOT is not installed. Press Deploy BBOT to install the latest stable version.')
      return
    }

    if (!selectedPreset) {
      setScanResults('Loading BBOT presets...')
      return
    }

    if (parsedTargets.length === 0) {
      alert('Please enter at least one target')
      return
    }

    setScanResults(viewPreset ? 'Loading current preset...' : `Scanning ${parsedTargets.length} target${parsedTargets.length === 1 ? '' : 's'}...`)

    sendMessage('runScan', {
      target: parsedTargets[0],
      targets: parsedTargets,
      whitelist: parsedWhitelist,
      blacklist: parsedBlacklist,
      scanType: selectedPreset,
      deadly: allowDeadly ? '--allow-deadly' : '',
      eventType: selectedEventType,
      moddep: moduleDep,
      flagType: selectedFlag,
      burp: useBurp,
      viewtype: viewPreset,
      scope: strictScope
    })
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleToggleStreaming = () => {
    const nextStreamValue = !isStreaming
    setIsStreaming(nextStreamValue)
    sendMessage('toggleStream', { stream: nextStreamValue })
  }

  const showDeployButton = environmentState.hostConfigured && (environmentState.status === 'missing' || environmentState.status === 'outdated')
  const showStatusBanner = ['checking', 'host-missing', 'missing', 'outdated'].includes(environmentState.status)
  const deployButtonLabel = environmentState.status === 'outdated' ? 'Update BBOT' : 'Deploy BBOT'
  const bbotOptionsDisabled = !environmentState.hostConfigured || !environmentState.bbotInstalled || (environmentState.bbotInstalled && !environmentState.capabilitiesLoaded)
  const scanDisabled = !environmentState.hostConfigured || !environmentState.bbotInstalled || !selectedPreset || parseListInput(target).length === 0

  return (
    <div className={`app-container ${zoom !== 1 ? 'zoomed' : ''}`} style={zoom !== 1 ? { transform: `scale(${zoom})` } : undefined}>
      <h1>
        <div className="header-content">
          <div className="header-left">
            {currentLayout === 'black-lantern' ? (
              <img
                src={currentTheme === 'light' ? '/assets/header/black_lantern_logo_dark.svg' : '/assets/header/black_lantern_logo_light.svg'}
                alt="Black Lantern Security"
                className="header-logo"
              />
            ) : (
              <>
                <img src="/assets/icons/icon32.png" alt="BBOT" width="32" height="32" />
                <span className="header-title">
                  <span className="orange-b">B</span>
                  <span className="black-text">BOT</span>
                  <span className="white-text"> Scanner</span>
                </span>
              </>
            )}
          </div>
          <div className="theme-selector">
            <div className="button-container">
              {showDeployButton && (
                <button className="deploy-button" onClick={handleDeploy}>
                  <Download size={14} /> {deployButtonLabel}
                </button>
              )}
              <button className="styles-button" onClick={() => setShowThemeMenu(!showThemeMenu)}>
                Styles
              </button>
            </div>
            {showThemeMenu && (
              <div className="theme-menu">
                <div className="theme-menu-section">
                  <h3>Layouts</h3>
                  <button className={clsx('theme-option', { active: currentLayout === 'default' })} onClick={() => handleLayoutChange('default')}>
                    Default Layout
                  </button>
                  <button className={clsx('theme-option', { active: currentLayout === 'compact' })} onClick={() => handleLayoutChange('compact')}>
                    Compact
                  </button>
                  <button className={clsx('theme-option', { active: currentLayout === 'classic' })} onClick={() => handleLayoutChange('classic')}>
                    Classic
                  </button>
                  <button className={clsx('theme-option', { active: currentLayout === 'modern' })} onClick={() => handleLayoutChange('modern')}>
                    Modern
                  </button>
                  <button className={clsx('theme-option', { active: currentLayout === 'matrix' })} onClick={() => handleLayoutChange('matrix')}>
                    Matrix Terminal
                  </button>
                  <button className={clsx('theme-option', { active: currentLayout === 'midnight' })} onClick={() => handleLayoutChange('midnight')}>
                    Midnight
                  </button>
                  <button className={clsx('theme-option', { active: currentLayout === 'black-lantern' })} onClick={() => handleLayoutChange('black-lantern')}>
                    Black Lantern
                  </button>
                </div>
                <div className="theme-menu-section">
                  <h3>Themes</h3>
                  <button className={clsx('theme-option', { active: currentTheme === 'default' })} onClick={() => handleThemeChange('default')}>
                    Default Theme
                  </button>
                  <button className={clsx('theme-option', { active: currentTheme === 'dark' })} onClick={() => handleThemeChange('dark')}>
                    Cyberpunk Dark
                  </button>
                  <button className={clsx('theme-option', { active: currentTheme === 'light' })} onClick={() => handleThemeChange('light')}>
                    Modern Light
                  </button>
                  <button className={clsx('theme-option', { active: currentTheme === 'matrix' })} onClick={() => handleThemeChange('matrix')}>
                    Matrix
                  </button>
                  <button className={clsx('theme-option', { active: currentTheme === 'midnight' })} onClick={() => handleThemeChange('midnight')}>
                    Midnight
                  </button>
                  <button className={clsx('theme-option', { active: currentTheme === 'black-lantern' })} onClick={() => handleThemeChange('black-lantern')}>
                    Black Lantern
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </h1>

      {showStatusBanner && (
        <div className={clsx('status-banner', {
          warning: environmentState.status === 'missing' || environmentState.status === 'outdated',
          error: environmentState.status === 'host-missing',
          neutral: environmentState.status === 'checking'
        })}>
          <div className="status-message-block">
            <span>{environmentState.message}</span>
            {environmentState.status === 'host-missing' && (
              <code className="status-command">bash install.sh</code>
            )}
          </div>
          {(environmentState.installedVersion || environmentState.latestVersion) && (
            <span className="status-meta">
              {environmentState.installedVersion && <span>Installed: v{environmentState.installedVersion}</span>}
              {environmentState.latestVersion && <span>Latest: v{environmentState.latestVersion}</span>}
            </span>
          )}
        </div>
      )}

      <div className={`main-content ${isSettingsCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}>
          <span><Shield size={16} /> Settings</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="settings-section">
          <div className="select-group">
            <label>Targets</label>
            <textarea
              id="target"
              rows="4"
              placeholder="Enter one target per line"
              className="target-input target-textarea"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </div>

          {recentDomains.length > 0 && (
            <div className="select-group">
              <label>Add Recent Domain</label>
              <select
                id="recentDomains"
                className="select-field recent-targets-select"
                defaultValue=""
                onChange={(event) => {
                  setTarget((previous) => appendListValue(previous, event.target.value))
                  event.target.value = ''
                }}
              >
                <option value="">Select from history</option>
                {recentDomains.map((domain, index) => (
                  <option key={index} value={domain}>{domain}</option>
                ))}
              </select>
            </div>
          )}

          <select
            id="scanSelect"
            className="select-field"
            value={selectedPreset}
            onChange={(event) => setSelectedPreset(event.target.value)}
            disabled={bbotOptionsDisabled}
          >
            {environmentState.presets.length === 0 ? (
              <option value="">
                {environmentState.bbotInstalled ? 'Loading presets...' : 'BBOT not installed'}
              </option>
            ) : (
              environmentState.presets.map((preset) => (
                <option key={preset} value={preset}>{preset}</option>
              ))
            )}
          </select>

          <select
            id="eventTypeSelect"
            className="select-field"
            value={selectedEventType}
            onChange={(event) => setSelectedEventType(event.target.value)}
            disabled={bbotOptionsDisabled}
          >
            <option value="*">All Events (*)</option>
            {environmentState.eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>{eventType}</option>
            ))}
          </select>

          <button className="action-button scan-button" onClick={handleScan} disabled={scanDisabled}>
            <Play size={14} /> Run Scan
          </button>
        </div>
      </div>

      <div className={`main-content ${isControlsCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}>
          <span><Shield size={16} /> Scan Controls</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="controls-section">
          <div className="advanced-settings">
            <div className="select-group">
              <label>Module Dependencies</label>
              <select
                id="modDeps"
                className="select-field"
                value={moduleDep}
                onChange={(event) => setModuleDep(event.target.value)}
              >
                {MODULE_DEP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="select-group">
              <label>Flag Type</label>
              <select
                id="flagSelect"
                className="select-field"
                value={selectedFlag}
                onChange={(event) => setSelectedFlag(event.target.value)}
                disabled={bbotOptionsDisabled}
              >
                <option value="">N/A</option>
                {environmentState.flags.map((flag) => (
                  <option key={flag} value={flag}>{flag}</option>
                ))}
              </select>
            </div>

            <div className="select-group">
              <label>Whitelist</label>
              <textarea
                id="whitelistInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional in-scope targets, one per line"
                value={whitelistTargets}
                onChange={(event) => setWhitelistTargets(event.target.value)}
              />
            </div>

            <div className="select-group">
              <label>Blacklist</label>
              <textarea
                id="blacklistInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional excluded targets, one per line"
                value={blacklistTargets}
                onChange={(event) => setBlacklistTargets(event.target.value)}
              />
            </div>

            <div className="checkbox-group">
              <label>
                <input type="checkbox" id="allowDeadly" checked={allowDeadly} onChange={(event) => setAllowDeadly(event.target.checked)} />
                Allow Deadly
              </label>
              <label>
                <input type="checkbox" id="burpsuite" checked={useBurp} onChange={(event) => setUseBurp(event.target.checked)} />
                Use Burp Proxy
              </label>
              <label>
                <input type="checkbox" id="viewPreset" checked={viewPreset} onChange={(event) => setViewPreset(event.target.checked)} />
                View Preset
              </label>
              <label>
                <input type="checkbox" id="strictScope" checked={strictScope} onChange={(event) => setStrictScope(event.target.checked)} />
                Strict Scope
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className={`main-content ${isActionsCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsActionsCollapsed(!isActionsCollapsed)}>
          <span><Shield size={16} /> Actions</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="controls-section">
          <div className="button-row">
            <div className="button-group">
              <button className="action-button" onClick={() => sendMessage('getOutput')}>
                <Terminal size={14} /> Stream Output
              </button>
              <button className="action-button" onClick={() => sendMessage('getOutfile')}>
                <FileSearch size={14} /> Get Outfiles
              </button>
              <button className="action-button" onClick={() => sendMessage('clearOutput')}>
                <Trash2 size={14} /> Clear Output
              </button>
            </div>
            <div className="button-group">
              <button className="action-button" onClick={() => sendMessage('clearHosts')}>
                <Trash2 size={14} /> Clear Targets
              </button>
              <button className="action-button" onClick={() => sendMessage('getURLS')}>
                <Target size={14} /> Get URLs
              </button>
              <button className="action-button" onClick={() => sendMessage('getHosts')}>
                <Database size={14} /> Scanned Targets
              </button>
            </div>
            <div className="button-group">
              <button className="action-button" onClick={handleToggleStreaming}>
                <Terminal size={14} /> {isStreaming ? 'Pause Streaming' : 'Resume Streaming'}
              </button>
              <button className="action-button" onClick={() => sendMessage('killScan')}>
                <XCircle size={14} /> Kill Scan
              </button>
              <select
                id="getSubdomains"
                className="select-field"
                onChange={(event) => {
                  const selectedPath = event.target.value
                  if (selectedPath) {
                    sendMessage('getSubdomains', { subdomains: selectedPath })
                  }
                }}
              >
                <option value="">Select Subdomain File</option>
                {subdomainFiles.map((file, index) => (
                  <option key={index} value={file}>{file.split('/').slice(-2).join('/')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="output-section">
        <div className={`output-container targets-output-container ${isTargetsCollapsed ? 'collapsed' : ''}`} style={{ '--current-icon': `url(${outputIcon})` }}>
          <h2 onClick={() => setIsTargetsCollapsed(!isTargetsCollapsed)}>
            <span><Shield size={16} /> Scanned Targets</span>
            <ChevronDown className="chevron" size={16} />
          </h2>
          {!isTargetsCollapsed && (
            <pre id="hostsArea" className="hosts-area">{hosts}</pre>
          )}
        </div>

        <div className={`output-container scan-output-container ${isOutputCollapsed ? 'collapsed' : ''}`} style={{ '--current-icon': `url(${outputIcon})` }}>
          <h2 onClick={() => setIsOutputCollapsed(!isOutputCollapsed)}>
            <span><Shield size={16} /> Scan Output</span>
            <ChevronDown className="chevron" size={16} />
          </h2>
          {!isOutputCollapsed && (
            <>
              <div className="tabs">
                <div className={clsx('tab', { active: activeTab === 'raw' })} onClick={() => handleTabChange('raw')}>
                  Raw Output
                </div>
                <div className={clsx('tab', { active: activeTab === 'urls' })} onClick={() => handleTabChange('urls')}>
                  URLs
                </div>
                <div className={clsx('tab', { active: activeTab === 'outfiles' })} onClick={() => handleTabChange('outfiles')}>
                  Outfiles
                </div>
                <div className={clsx('tab', { active: activeTab === 'subdomains' })} onClick={() => handleTabChange('subdomains')}>
                  Subdomains
                </div>
              </div>
              <div className={clsx('tab-content', { active: activeTab === 'raw' })}>
                <pre id="results" className="results-container">
                  {scanResults || <p className="empty-state">No scan results yet</p>}
                </pre>
              </div>
              <div className={clsx('tab-content', { active: activeTab === 'urls' })}>
                <pre id="urlsOutput" className="results-container">
                  {urlsOutput || <p className="empty-state">No URLs extracted yet</p>}
                </pre>
              </div>
              <div className={clsx('tab-content', { active: activeTab === 'outfiles' })}>
                <pre id="outfilesOutput" className="results-container">
                  {outfilesOutput || <p className="empty-state">No outfiles extracted yet</p>}
                </pre>
              </div>
              <div className={clsx('tab-content', { active: activeTab === 'subdomains' })}>
                <pre id="subdomainsOutput" className="results-container">
                  {subdomainsOutput || <p className="empty-state">No subdomains loaded yet</p>}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
