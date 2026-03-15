import React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
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
  modules: [],
  outputModules: [],
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

const AVAILABLE_LAYOUTS = ['default', 'compact', 'classic', 'modern', 'matrix', 'midnight', 'black-lantern']
const AVAILABLE_THEMES = ['default', 'dark', 'light', 'matrix', 'midnight', 'black-lantern']
const LAYOUT_CLASS_NAMES = ['layout-compact', 'layout-classic', 'layout-modern', 'layout-matrix', 'layout-midnight', 'layout-black-lantern']
const THEME_CLASS_NAMES = ['theme-dark', 'theme-light', 'theme-matrix', 'theme-midnight', 'theme-black-lantern']

const SIDEBAR_MODES = [
  { value: 'light', label: 'Light' },
  { value: 'heavy', label: 'Heavy' },
  { value: 'custom', label: 'Custom' }
]

const SIDEBAR_SECTIONS = [
  { id: 'settings', label: 'Settings' },
  { id: 'controls', label: 'Scan Controls' },
  { id: 'composition', label: 'Modules & Flags' },
  { id: 'reports', label: 'Output & Reports' },
  { id: 'actions', label: 'Actions' },
  { id: 'targets', label: 'Scanned Targets' },
  { id: 'output', label: 'Scan Output' }
]

const SIDEBAR_STORAGE_KEYS = ['lastScan', 'sidebarMode', 'customSections', 'savedSidebarLayouts', 'selectedSidebarLayout', 'currentLayout', 'currentTheme']

function buildSectionVisibility(sectionIds) {
  return SIDEBAR_SECTIONS.reduce((result, section) => {
    result[section.id] = sectionIds.includes(section.id)
    return result
  }, {})
}

const LIGHT_SIDEBAR_SECTIONS = buildSectionVisibility(['settings', 'targets', 'output'])
const HEAVY_SIDEBAR_SECTIONS = buildSectionVisibility(SIDEBAR_SECTIONS.map((section) => section.id))

function normalizeLayoutValue(value) {
  return AVAILABLE_LAYOUTS.includes(value) ? value : 'default'
}

function normalizeThemeValue(value) {
  return AVAILABLE_THEMES.includes(value) ? value : 'default'
}

function normalizeSectionVisibility(value, fallback = HEAVY_SIDEBAR_SECTIONS) {
  const normalized = { ...fallback }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized
  }

  SIDEBAR_SECTIONS.forEach(({ id }) => {
    if (id in value) {
      normalized[id] = Boolean(value[id])
    }
  })

  return normalized
}

function normalizeSavedSidebarLayoutEntry(value, fallbackAppearance = {}) {
  const fallbackLayout = normalizeLayoutValue(fallbackAppearance.layout)
  const fallbackTheme = normalizeThemeValue(fallbackAppearance.theme)
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      sections: { ...HEAVY_SIDEBAR_SECTIONS },
      layout: fallbackLayout,
      theme: fallbackTheme
    }
  }

  const rawSections = value.sections && typeof value.sections === 'object' && !Array.isArray(value.sections)
    ? value.sections
    : value

  return {
    sections: normalizeSectionVisibility(rawSections),
    layout: normalizeLayoutValue(value.layout || fallbackLayout),
    theme: normalizeThemeValue(value.theme || fallbackTheme)
  }
}

function normalizeSavedSidebarLayouts(value, fallbackAppearance = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([name]) => String(name || '').trim())
      .map(([name, layoutValue]) => [String(name).trim(), normalizeSavedSidebarLayoutEntry(layoutValue, fallbackAppearance)])
  )
}

function normalizeSidebarImportData(value, fallbackName = 'Imported Layout') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const fallbackAppearance = {
    layout: value.currentLayout || value.layout,
    theme: value.currentTheme || value.theme
  }
  const normalizedSavedLayouts = normalizeSavedSidebarLayouts(value.savedLayouts, fallbackAppearance)
  const hasSavedLayouts = Object.keys(normalizedSavedLayouts).length > 0

  if (hasSavedLayouts) {
    const requestedLayout = String(value.selectedLayout || '').trim()
    const firstLayout = Object.keys(normalizedSavedLayouts)[0]
    const selectedLayout = requestedLayout && normalizedSavedLayouts[requestedLayout] ? requestedLayout : firstLayout
    return {
      savedLayouts: normalizedSavedLayouts,
      selectedLayout,
      customSections: { ...normalizedSavedLayouts[selectedLayout].sections },
      currentLayout: normalizedSavedLayouts[selectedLayout].layout,
      currentTheme: normalizedSavedLayouts[selectedLayout].theme
    }
  }

  const rawSections = value.currentSections || value.customSections || value.sections
  if (!rawSections || typeof rawSections !== 'object' || Array.isArray(rawSections)) {
    return null
  }

  const normalizedSections = normalizeSectionVisibility(rawSections)
  const layoutName = String(value.name || fallbackName).trim() || fallbackName
  return {
    savedLayouts: {
      [layoutName]: {
        sections: normalizedSections,
        layout: normalizeLayoutValue(value.currentLayout || value.layout),
        theme: normalizeThemeValue(value.currentTheme || value.theme)
      }
    },
    selectedLayout: layoutName,
    customSections: normalizedSections,
    currentLayout: normalizeLayoutValue(value.currentLayout || value.layout),
    currentTheme: normalizeThemeValue(value.currentTheme || value.theme)
  }
}

function buildSidebarLayoutFileName(value) {
  const stem = String(value || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${stem || 'custom-sidebar-layout'}.bbot-sidebar.json`
}

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
  const [isCompositionCollapsed, setIsCompositionCollapsed] = useState(true)
  const [isReportsCollapsed, setIsReportsCollapsed] = useState(true)
  const [isActionsCollapsed, setIsActionsCollapsed] = useState(true)
  const [isSidebarBuilderCollapsed, setIsSidebarBuilderCollapsed] = useState(false)
  const [outputIcon, setOutputIcon] = useState('bls_icon_light.png')
  const [isStreaming, setIsStreaming] = useState(true)
  const [activeTab, setActiveTab] = useState('raw')
  const [recentDomains, setRecentDomains] = useState([])
  const [subdomainFiles, setSubdomainFiles] = useState([])
  const [zoom, setZoom] = useState(1)
  const [environmentState, setEnvironmentState] = useState(DEFAULT_ENVIRONMENT_STATE)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [selectedEventType, setSelectedEventType] = useState('*')
  const [moduleDep, setModuleDep] = useState('--ignore-failed-deps')
  const [allowDeadly, setAllowDeadly] = useState(false)
  const [useBurp, setUseBurp] = useState(false)
  const [viewPreset, setViewPreset] = useState(false)
  const [strictScope, setStrictScope] = useState(false)
  const [whitelistTargets, setWhitelistTargets] = useState('')
  const [blacklistTargets, setBlacklistTargets] = useState('')
  const [includedModules, setIncludedModules] = useState('')
  const [excludedModules, setExcludedModules] = useState('')
  const [includedFlags, setIncludedFlags] = useState('')
  const [requiredFlags, setRequiredFlags] = useState('')
  const [excludedFlags, setExcludedFlags] = useState('')
  const [scanName, setScanName] = useState('')
  const [outputModulesInput, setOutputModulesInput] = useState('')
  const [sidebarMode, setSidebarMode] = useState('light')
  const [customSections, setCustomSections] = useState(() => ({ ...HEAVY_SIDEBAR_SECTIONS }))
  const [savedSidebarLayouts, setSavedSidebarLayouts] = useState({})
  const [customLayoutName, setCustomLayoutName] = useState('')
  const [selectedSidebarLayout, setSelectedSidebarLayout] = useState('')
  const [sidebarPrefsLoaded, setSidebarPrefsLoaded] = useState(false)
  const [customLayoutStatus, setCustomLayoutStatus] = useState('')
  const customLayoutFileInputRef = useRef(null)

  const applyEnvironmentState = useCallback((data) => {
    if (!data) {
      return
    }

    setEnvironmentState((previous) => ({
      ...previous,
      ...data,
      presets: Array.isArray(data.presets) ? data.presets : previous.presets,
      modules: Array.isArray(data.modules) ? data.modules : previous.modules,
      outputModules: Array.isArray(data.outputModules) ? data.outputModules : previous.outputModules,
      flags: Array.isArray(data.flags) ? data.flags : previous.flags,
      eventTypes: Array.isArray(data.eventTypes) && data.eventTypes.length > 0 ? data.eventTypes : previous.eventTypes
    }))
  }, [])

  const applyAppearance = useCallback((layoutValue, themeValue) => {
    const nextLayout = normalizeLayoutValue(layoutValue)
    const nextTheme = normalizeThemeValue(themeValue)

    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove(...LAYOUT_CLASS_NAMES, ...THEME_CLASS_NAMES)
      if (nextLayout !== 'default') {
        document.body.classList.add(`layout-${nextLayout}`)
      }
      if (nextTheme !== 'default') {
        document.body.classList.add(`theme-${nextTheme}`)
      }
    }

    if (nextLayout === 'black-lantern') {
      setOutputIcon(nextTheme === 'light' ? '/assets/logos/bls_icon_dark.png' : '/assets/logos/bls_icon_light.png')
    }

    setCurrentLayout(nextLayout)
    setCurrentTheme(nextTheme)
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
      browser.storage.local.get(SIDEBAR_STORAGE_KEYS).then((result) => {
        if (result.lastScan) {
          setScanResults(result.lastScan)
        }
        const fallbackAppearance = {
          layout: result.currentLayout,
          theme: result.currentTheme
        }
        const normalizedLayouts = normalizeSavedSidebarLayouts(result.savedSidebarLayouts, fallbackAppearance)
        if (SIDEBAR_MODES.some((mode) => mode.value === result.sidebarMode)) {
          setSidebarMode(result.sidebarMode)
        }
        if (result.customSections) {
          setCustomSections(normalizeSectionVisibility(result.customSections))
        }
        if (result.savedSidebarLayouts) {
          setSavedSidebarLayouts(normalizedLayouts)
        }
        if (typeof result.selectedSidebarLayout === 'string') {
          setSelectedSidebarLayout(result.selectedSidebarLayout)
        }
        const selectedLayout = typeof result.selectedSidebarLayout === 'string' ? normalizedLayouts[result.selectedSidebarLayout] : null
        applyAppearance(
          result.currentLayout || (selectedLayout ? selectedLayout.layout : 'default'),
          result.currentTheme || (selectedLayout ? selectedLayout.theme : 'default')
        )
        setSidebarPrefsLoaded(true)
      }).catch((error) => {
        console.error('Failed to access browser.storage.local:', error)
        setSidebarPrefsLoaded(true)
      })
    } else {
      setSidebarPrefsLoaded(true)
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
      if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
        browser.runtime.onMessage.removeListener?.(listener)
      }
    }
  }, [applyAppearance, applyEnvironmentState])

  useEffect(() => {
    if (environmentState.presets.length > 0 && !environmentState.presets.includes(selectedPreset)) {
      setSelectedPreset(environmentState.presets[0])
    }
  }, [environmentState.presets, selectedPreset])

  useEffect(() => {
    if (selectedEventType !== '*' && !environmentState.eventTypes.includes(selectedEventType)) {
      setSelectedEventType('*')
    }
  }, [environmentState.eventTypes, selectedEventType])

  useEffect(() => {
    if (!sidebarPrefsLoaded || typeof browser === 'undefined' || !browser.storage || !browser.storage.local) {
      return
    }

    browser.storage.local.set({
      sidebarMode,
      customSections,
      savedSidebarLayouts,
      selectedSidebarLayout,
      currentLayout,
      currentTheme
    }).catch(() => {})
  }, [currentLayout, currentTheme, customSections, savedSidebarLayouts, selectedSidebarLayout, sidebarMode, sidebarPrefsLoaded])

  const handleDeploy = () => {
    if (!environmentState.hostConfigured) {
      setScanResults(environmentState.message || 'Native host is not configured.')
      return
    }

    sendMessage('deployBbot')
    setScanResults(environmentState.updateAvailable ? 'Updating BBOT...' : 'Deploying BBOT...')
  }

  const handleThemeChange = (theme) => {
    applyAppearance(currentLayout, theme)
    setShowThemeMenu(false)
  }

  const handleLayoutChange = (layout) => {
    applyAppearance(layout, currentTheme)
    setShowThemeMenu(false)
  }

  const handleSidebarModeChange = (nextMode) => {
    setSidebarMode(nextMode)
    if (nextMode === 'custom') {
      setIsSidebarBuilderCollapsed(false)
    }
  }

  const handleCustomSectionToggle = (sectionId) => {
    setCustomSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId]
    }))
    setCustomLayoutStatus('')
  }

  const handleSaveCustomLayout = () => {
    const normalizedName = customLayoutName.trim()
    if (!normalizedName) {
      return
    }

    setSavedSidebarLayouts((previous) => ({
      ...previous,
      [normalizedName]: {
        sections: { ...customSections },
        layout: currentLayout,
        theme: currentTheme
      }
    }))
    setSelectedSidebarLayout(normalizedName)
    setCustomLayoutName('')
    setCustomLayoutStatus(`Saved layout "${normalizedName}" locally.`)
  }

  const handleLoadCustomLayout = (layoutName) => {
    setSelectedSidebarLayout(layoutName)
    if (!layoutName || !savedSidebarLayouts[layoutName]) {
      setCustomLayoutStatus('')
      return
    }

    setCustomSections(normalizeSectionVisibility(savedSidebarLayouts[layoutName].sections))
    applyAppearance(savedSidebarLayouts[layoutName].layout, savedSidebarLayouts[layoutName].theme)
    setCustomLayoutStatus(`Loaded layout "${layoutName}".`)
  }

  const handleDeleteCustomLayout = () => {
    if (!selectedSidebarLayout) {
      return
    }

    setSavedSidebarLayouts((previous) => {
      const nextLayouts = { ...previous }
      delete nextLayouts[selectedSidebarLayout]
      return nextLayouts
    })
    setCustomLayoutStatus(`Deleted layout "${selectedSidebarLayout}".`)
    setSelectedSidebarLayout('')
  }

  const handleExportCustomLayout = () => {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setCustomLayoutStatus('This browser cannot export layout files.')
      return
    }

    const fileName = buildSidebarLayoutFileName(selectedSidebarLayout || customLayoutName || 'custom-sidebar-layout')
    const payload = {
      version: 1,
      sidebarMode: 'custom',
      currentSections: customSections,
      currentLayout,
      currentTheme,
      savedLayouts: savedSidebarLayouts,
      selectedLayout: selectedSidebarLayout
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const downloadLink = document.createElement('a')
    downloadLink.href = objectUrl
    downloadLink.download = fileName
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    URL.revokeObjectURL(objectUrl)
    setCustomLayoutStatus(`Exported layout file "${fileName}".`)
  }

  const handleChooseCustomLayoutFile = () => {
    customLayoutFileInputRef.current?.click()
  }

  const handleImportCustomLayoutFile = async (event) => {
    const [file] = Array.from(event.target.files || [])
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const text = typeof file.text === 'function'
        ? await file.text()
        : await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Failed to read layout file.'))
          reader.readAsText(file)
        })
      const imported = normalizeSidebarImportData(
        JSON.parse(text),
        file.name.replace(/\.[^.]+$/, '').trim() || 'Imported Layout'
      )

      if (!imported) {
        throw new Error('Invalid layout file.')
      }

      setSidebarMode('custom')
      setIsSidebarBuilderCollapsed(false)
      setSavedSidebarLayouts((previous) => ({
        ...previous,
        ...imported.savedLayouts
      }))
      setSelectedSidebarLayout(imported.selectedLayout)
      setCustomSections(imported.customSections)
      applyAppearance(imported.currentLayout, imported.currentTheme)
      setCustomLayoutStatus(`Loaded layout file "${file.name}".`)
    } catch (error) {
      setCustomLayoutStatus(error && error.message ? error.message : 'Failed to load layout file.')
    }
  }

  const handleScan = () => {
    const parsedTargets = parseListInput(target)
    const parsedWhitelist = parseListInput(whitelistTargets)
    const parsedBlacklist = parseListInput(blacklistTargets)
    const parsedIncludedModules = parseListInput(includedModules)
    const parsedExcludedModules = parseListInput(excludedModules)
    const parsedIncludedFlags = parseListInput(includedFlags)
    const parsedRequiredFlags = parseListInput(requiredFlags)
    const parsedExcludedFlags = parseListInput(excludedFlags)
    const parsedOutputModules = parseListInput(outputModulesInput)

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
      modules: parsedIncludedModules,
      excludedModules: parsedExcludedModules,
      flags: parsedIncludedFlags,
      requiredFlags: parsedRequiredFlags,
      excludedFlags: parsedExcludedFlags,
      scanName: scanName.trim(),
      outputModules: parsedOutputModules,
      scanType: selectedPreset,
      deadly: allowDeadly ? '--allow-deadly' : '',
      eventType: selectedEventType,
      moddep: moduleDep,
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
  const visibleSections = sidebarMode === 'light'
    ? LIGHT_SIDEBAR_SECTIONS
    : sidebarMode === 'heavy'
      ? HEAVY_SIDEBAR_SECTIONS
      : customSections
  const hasControlSections = visibleSections.settings || visibleSections.controls || visibleSections.composition || visibleSections.reports || visibleSections.actions
  const hasOutputSections = visibleSections.targets || visibleSections.output
  const hasExpandedOutputSection = (visibleSections.targets && !isTargetsCollapsed) || (visibleSections.output && !isOutputCollapsed)
  const controlsExpanded = !hasOutputSections || !hasExpandedOutputSection
  const outputsFullyCollapsed = hasOutputSections && !hasExpandedOutputSection
  const visibleSectionCount = SIDEBAR_SECTIONS.filter(({ id }) => visibleSections[id]).length
  const savedSidebarLayoutNames = Object.keys(savedSidebarLayouts).sort((left, right) => left.localeCompare(right))
  const sidebarModeSummary = sidebarMode === 'light'
    ? 'Essentials only'
    : sidebarMode === 'heavy'
      ? 'All sections visible'
      : `${visibleSectionCount} sections enabled`

  return (
    <div
      className={clsx('app-container', {
        zoomed: zoom !== 1,
        'sidebar-mode-heavy': sidebarMode === 'heavy'
      })}
      style={zoom !== 1 ? { transform: `scale(${zoom})` } : undefined}
    >
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

      <div className="main-content sidebar-mode-bar">
        <div className="select-group sidebar-mode-select-group">
          <label>Sidebar Mode</label>
          <select
            id="sidebarModeSelect"
            className="select-field"
            value={sidebarMode}
            onChange={(event) => handleSidebarModeChange(event.target.value)}
          >
            {SIDEBAR_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>{mode.label}</option>
            ))}
          </select>
        </div>
        <span className="sidebar-mode-summary">{sidebarModeSummary}</span>
      </div>

      {sidebarMode === 'custom' && (
        <div className={`main-content ${isSidebarBuilderCollapsed ? 'collapsed' : ''}`}>
          <h2 onClick={() => setIsSidebarBuilderCollapsed(!isSidebarBuilderCollapsed)}>
            <span><Shield size={16} /> Custom Sidebar</span>
            <ChevronDown className="chevron" size={16} />
          </h2>
          <div className="controls-section">
            <div className="advanced-settings custom-sidebar-settings">
              <div className="select-group">
                <label>Load Saved Layout</label>
                <select
                  id="savedSidebarLayoutSelect"
                  className="select-field"
                  value={selectedSidebarLayout}
                  onChange={(event) => handleLoadCustomLayout(event.target.value)}
                  disabled={savedSidebarLayoutNames.length === 0}
                >
                  <option value="">{savedSidebarLayoutNames.length > 0 ? 'Select saved layout' : 'No saved layouts yet'}</option>
                  {savedSidebarLayoutNames.map((layoutName) => (
                    <option key={layoutName} value={layoutName}>{layoutName}</option>
                  ))}
                </select>
              </div>

              <div className="select-group">
                <label>Save Current Layout</label>
                <input
                  type="text"
                  id="customLayoutNameInput"
                  className="target-input"
                  placeholder="Layout name"
                  value={customLayoutName}
                  onChange={(event) => setCustomLayoutName(event.target.value)}
                />
                <div className="custom-layout-actions">
                  <button className="btn-primary" onClick={handleSaveCustomLayout} disabled={!customLayoutName.trim()}>
                    Save Layout
                  </button>
                  <button className="btn-secondary" onClick={handleDeleteCustomLayout} disabled={!selectedSidebarLayout}>
                    Delete Layout
                  </button>
                  <button className="btn-secondary" onClick={handleExportCustomLayout}>
                    Export Layout File
                  </button>
                  <button className="btn-secondary" onClick={handleChooseCustomLayoutFile}>
                    Load Layout File
                  </button>
                </div>
                <input
                  ref={customLayoutFileInputRef}
                  id="customLayoutFileInput"
                  className="hidden-file-input"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportCustomLayoutFile}
                />
                {customLayoutStatus && (
                  <span className="custom-layout-status" role="status">{customLayoutStatus}</span>
                )}
              </div>

              <div className="select-group">
                <label>Visible Sections</label>
                <div className="section-toggle-grid">
                  {SIDEBAR_SECTIONS.map((section) => (
                    <label key={section.id} className="section-toggle-option">
                      <input
                        type="checkbox"
                        id={`customSection-${section.id}`}
                        checked={Boolean(customSections[section.id])}
                        onChange={() => handleCustomSectionToggle(section.id)}
                      />
                      {section.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasControlSections && (
      <div className={clsx('control-sections', { expanded: controlsExpanded })}>
      {visibleSections.settings && (
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
      )}

      {visibleSections.controls && (
      <div className={`main-content ${isControlsCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}>
          <span><Shield size={16} /> Scan Controls</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="controls-section">
          <div className="advanced-settings">
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
      )}

      {visibleSections.composition && (
      <div className={`main-content ${isCompositionCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsCompositionCollapsed(!isCompositionCollapsed)}>
          <span><Shield size={16} /> Modules & Flags</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="controls-section">
          <div className="advanced-settings compact-settings-grid">
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
              <label>Include Modules</label>
              <textarea
                id="includeModulesInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional modules, one per line"
                value={includedModules}
                onChange={(event) => setIncludedModules(event.target.value)}
              />
              {environmentState.modules.length > 0 && (
                <select
                  id="addModuleSelect"
                  className="select-field helper-select"
                  defaultValue=""
                  onChange={(event) => {
                    setIncludedModules((previous) => appendListValue(previous, event.target.value))
                    event.target.value = ''
                  }}
                  disabled={bbotOptionsDisabled}
                >
                  <option value="">Add available module</option>
                  {environmentState.modules.map((module) => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="select-group">
              <label>Exclude Modules</label>
              <textarea
                id="excludeModulesInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional excluded modules, one per line"
                value={excludedModules}
                onChange={(event) => setExcludedModules(event.target.value)}
              />
              {environmentState.modules.length > 0 && (
                <select
                  id="excludeModuleSelect"
                  className="select-field helper-select"
                  defaultValue=""
                  onChange={(event) => {
                    setExcludedModules((previous) => appendListValue(previous, event.target.value))
                    event.target.value = ''
                  }}
                  disabled={bbotOptionsDisabled}
                >
                  <option value="">Exclude available module</option>
                  {environmentState.modules.map((module) => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="select-group">
              <label>Include Flags</label>
              <textarea
                id="includeFlagsInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional flags, one per line"
                value={includedFlags}
                onChange={(event) => setIncludedFlags(event.target.value)}
              />
              {environmentState.flags.length > 0 && (
                <select
                  id="addFlagSelect"
                  className="select-field helper-select"
                  defaultValue=""
                  onChange={(event) => {
                    setIncludedFlags((previous) => appendListValue(previous, event.target.value))
                    event.target.value = ''
                  }}
                  disabled={bbotOptionsDisabled}
                >
                  <option value="">Add available flag</option>
                  {environmentState.flags.map((flag) => (
                    <option key={flag} value={flag}>{flag}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="select-group">
              <label>Require Flags</label>
              <textarea
                id="requireFlagsInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional required flags, one per line"
                value={requiredFlags}
                onChange={(event) => setRequiredFlags(event.target.value)}
              />
              {environmentState.flags.length > 0 && (
                <select
                  id="requireFlagSelect"
                  className="select-field helper-select"
                  defaultValue=""
                  onChange={(event) => {
                    setRequiredFlags((previous) => appendListValue(previous, event.target.value))
                    event.target.value = ''
                  }}
                  disabled={bbotOptionsDisabled}
                >
                  <option value="">Require available flag</option>
                  {environmentState.flags.map((flag) => (
                    <option key={flag} value={flag}>{flag}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="select-group">
              <label>Exclude Flags</label>
              <textarea
                id="excludeFlagsInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Optional excluded flags, one per line"
                value={excludedFlags}
                onChange={(event) => setExcludedFlags(event.target.value)}
              />
              {environmentState.flags.length > 0 && (
                <select
                  id="excludeFlagSelect"
                  className="select-field helper-select"
                  defaultValue=""
                  onChange={(event) => {
                    setExcludedFlags((previous) => appendListValue(previous, event.target.value))
                    event.target.value = ''
                  }}
                  disabled={bbotOptionsDisabled}
                >
                  <option value="">Exclude available flag</option>
                  {environmentState.flags.map((flag) => (
                    <option key={flag} value={flag}>{flag}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {visibleSections.reports && (
      <div className={`main-content ${isReportsCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsReportsCollapsed(!isReportsCollapsed)}>
          <span><Shield size={16} /> Output & Reports</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="controls-section">
          <div className="advanced-settings compact-settings-grid">
            <div className="select-group">
              <label>Scan Name</label>
              <input
                type="text"
                id="scanNameInput"
                className="target-input"
                placeholder="Optional custom scan name"
                value={scanName}
                onChange={(event) => setScanName(event.target.value)}
              />
            </div>

            <div className="select-group">
              <label>Output Modules</label>
              <textarea
                id="outputModulesInput"
                rows="2"
                className="target-input target-textarea scope-textarea"
                placeholder="Additional output modules, one per line"
                value={outputModulesInput}
                onChange={(event) => setOutputModulesInput(event.target.value)}
              />
              {environmentState.outputModules.length > 0 && (
                <select
                  id="addOutputModuleSelect"
                  className="select-field helper-select"
                  defaultValue=""
                  onChange={(event) => {
                    setOutputModulesInput((previous) => appendListValue(previous, event.target.value))
                    event.target.value = ''
                  }}
                  disabled={bbotOptionsDisabled}
                >
                  <option value="">Add output module</option>
                  {environmentState.outputModules.map((module) => (
                    <option key={module} value={module}>{module}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {visibleSections.actions && (
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
      )}
      </div>
      )}

      {hasOutputSections && (
      <div className={clsx('output-section', { 'outputs-fully-collapsed': outputsFullyCollapsed })}>
        {visibleSections.targets && (
        <div className={`output-container targets-output-container ${isTargetsCollapsed ? 'collapsed' : ''}`} style={{ '--current-icon': `url(${outputIcon})` }}>
          <h2 onClick={() => setIsTargetsCollapsed(!isTargetsCollapsed)}>
            <span><Shield size={16} /> Scanned Targets</span>
            <ChevronDown className="chevron" size={16} />
          </h2>
          {!isTargetsCollapsed && (
            <pre id="hostsArea" className="hosts-area">{hosts}</pre>
          )}
        </div>
        )}

        {visibleSections.output && (
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
        )}
      </div>
      )}
    </div>
  )
}

export default App
