import React from 'react'
import { useState, useEffect, useCallback } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown, Shield, Scan, Terminal, Target, Database, FileSearch, Trash2, Play, Download, XCircle } from 'lucide-react'
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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false)
  const [isTargetsCollapsed, setIsTargetsCollapsed] = useState(false)
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false)
  const [outputIcon, setOutputIcon] = useState('bls_icon_light.png')
  const [isStreaming, setIsStreaming] = useState(true)
  const [activeTab, setActiveTab] = useState('raw')
  const [recentDomains, setRecentDomains] = useState([])
  const [subdomainFiles, setSubdomainFiles] = useState([])
  const [zoom, setZoom] = useState(1);

  const handleZoom = useCallback((delta) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 2));
  }, []);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        handleZoom(delta);
      }
    };

    const handleKeyboard = (e) => {
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoom(0.1);
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoom(-0.1);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyboard);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyboard);
    };
  }, [handleZoom]);

  useEffect(() => {
    document.documentElement.style.setProperty('--zoom-level', zoom)
  }, [zoom])

  // Fetch recent domains from browser history
  useEffect(() => {
    const fetchRecentDomains = async () => {
      try {
        if (typeof browser !== 'undefined' && browser.history) {
          const historyItems = await browser.history.search({ text: "", maxResults: 15 });
          const uniqueDomains = new Set();
          historyItems.forEach(item => {
            try {
              const urlObj = new URL(item.url);
              uniqueDomains.add(urlObj.hostname);
            } catch (e) {
              console.error("Invalid URL:", item.url);
            }
          });
          setRecentDomains([...uniqueDomains]);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
      }
    };
    fetchRecentDomains();
  }, []);

  // Fetch outfiles to populate the getSubdomains dropdown
  useEffect(() => {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({ type: "getOutfile" });
      browser.runtime.onMessage.addListener((message) => {
        if (message.type === "updateOutfiles") {
          const outfiles = message.data.split('\n').filter(line => line && !line.startsWith('Extracted Outfile:'));
          setSubdomainFiles(outfiles);
        }
      });
    }
  }, []);

  const handleDeploy = () => {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({
        type: "deployBbot"
      });
      setScanResults('Deploying BBOT...');
    }
  };

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

  useEffect(() => {
    // Load previous results from browser storage
    if (typeof browser !== 'undefined' && browser.storage) {
      try {
        browser.storage.local.get(['lastScan']).then(result => {
          if (result.lastScan) {
            setScanResults(result.lastScan)
          }
        })
      } catch (error) {
        console.error('Failed to access browser.storage.local:', error)
      }
    }

    // Listen for updates from background.js
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.onMessage.addListener((message) => {
        if (message.type === "updateOutput") {
          setScanResults(message.data)
        } else if (message.type === "updateURLs") {
          setUrlsOutput(message.data)
        } else if (message.type === "updateOutfiles") {
          setOutfilesOutput(message.data)
        } else if (message.type === "updateSubdomains") {
          setSubdomainsOutput(message.data)
        } else if (message.type === "updateHosts") {
          setHosts(message.data)
        }
      })
    }
  }, [])

  const handleScan = () => {
    if (!target.trim()) {
      alert('Please enter a target domain')
      return
    }

    setScanResults('Scanning target...')

    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({
        type: "runScan",
        target: target.trim(),
        scanType: document.getElementById('scanSelect').value,
        deadly: document.getElementById('deadly').value.trim(),
        eventType: document.getElementById('eventTypeSelect').value.trim() || "*",
        moddep: document.getElementById('modDeps').value.trim(),
        flagType: document.getElementById('flagSelect').value.trim(),
        burp: document.getElementById('burpsuite').checked,
        viewtype: document.getElementById('viewPreset').checked,
        scope: document.getElementById('strictScope').checked
      })
    }
  }

  const sendMessage = (type, additionalData = {}) => {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({ type, ...additionalData })
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleToggleStreaming = () => {
    setIsStreaming(!isStreaming)
    sendMessage("toggleStream", { stream: !isStreaming })
  }

  return (
    <div className={`app-container`} style={{ transform: `scale(${zoom})` }}>
      <h1>
        <>
          <div className="header-content">
            <div className="header-left">
              {currentLayout === 'black-lantern' ? (
                <img 
                  src={currentTheme === 'light' 
                    ? "/assets/header/black_lantern_logo_dark.svg" 
                    : "/assets/header/black_lantern_logo_light.svg"} 
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
                <button className="deploy-button" onClick={handleDeploy}>
                  <Download size={14} /> Deploy
                </button>
                <button className="styles-button" onClick={() => setShowThemeMenu(!showThemeMenu)}>
                  Styles
                </button>
              </div>
              {showThemeMenu && (
                <div className="theme-menu">
                  <div className="theme-menu-section">
                    <h3>Layouts</h3>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'default' })}
                      onClick={() => handleLayoutChange('default')}
                    >
                      Default Layout
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'compact' })}
                      onClick={() => handleLayoutChange('compact')}
                    >
                      Compact
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'classic' })}
                      onClick={() => handleLayoutChange('classic')}
                    >
                      Classic
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'modern' })}
                      onClick={() => handleLayoutChange('modern')}
                    >
                      Modern
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'matrix' })}
                      onClick={() => handleLayoutChange('matrix')}
                    >
                      Matrix Terminal
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'midnight' })}
                      onClick={() => handleLayoutChange('midnight')}
                    >
                      Midnight
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentLayout === 'black-lantern' })}
                      onClick={() => handleLayoutChange('black-lantern')}
                    >
                      Black Lantern
                    </button>
                  </div>
                  <div className="theme-menu-section">
                    <h3>Themes</h3>
                    <button 
                      className={clsx('theme-option', { active: currentTheme === 'default' })}
                      onClick={() => handleThemeChange('default')}
                    >
                      Default Theme
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentTheme === 'dark' })}
                      onClick={() => handleThemeChange('dark')}
                    >
                      Cyberpunk Dark
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentTheme === 'light' })}
                      onClick={() => handleThemeChange('light')}
                    >
                      Modern Light
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentTheme === 'matrix' })}
                      onClick={() => handleThemeChange('matrix')}
                    >
                      Matrix
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentTheme === 'midnight' })}
                      onClick={() => handleThemeChange('midnight')}
                    >
                      Midnight
                    </button>
                    <button 
                      className={clsx('theme-option', { active: currentTheme === 'black-lantern' })}
                      onClick={() => handleThemeChange('black-lantern')}
                    >
                      Black Lantern
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      </h1>

      <div className={`main-content ${isSettingsCollapsed ? 'collapsed' : ''}`}>
        <h2 onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}>
          <span><Shield size={16} /> Settings</span>
          <ChevronDown className="chevron" size={16} />
        </h2>
        <div className="settings-section">
          <div className="select-group">
            <label>Target</label>
            <input
              type="text"
              id="target"
              list="recentDomains"
              placeholder="Enter URL or select from history"
              className="target-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <datalist id="recentDomains">
              {recentDomains.map((domain, index) => (
                <option key={index} value={domain} />
              ))}
            </datalist>
          </div>

          <select id="scanSelect" className="select-field">
            <option value="baddns-thorough">BAD DNS Thorough</option>
            <option value="baddns-intense">BAD DNS Intense</option>
            <option value="cloud-enum">Cloud Enumeration</option>
            <option value="code-enum">Code Enumeration</option>
            <option value="dirbust-heavy">Directory Brute-force (Heavy)</option>
            <option value="dirbust-light">Directory Brute-force (Light)</option>
            <option value="dotnet-audit">.NET/IIS Audit</option>
            <option value="email-enum">Email Enumeration</option>
            <option value="fast">Fast Scan</option>
            <option value="iis-shortnames">IIS Shortname Enumeration</option>
            <option value="kitchen-sink">Kitchen Sink (All Modules)</option>
            <option value="lightfuzz-heavy">Lightfuzz Heavy</option>
            <option value="lightfuzz-light">Lightfuzz Light</option>
            <option value="lightfuzz-medium">Lightfuzz Medium</option>
            <option value="lightfuzz-superheavy">Lightfuzz Superheavy</option>
            <option value="lightfuzz-xss">Lightfuzz XSS</option>
            <option value="nuclei">Nuclei</option>
            <option value="nuclei-budget">Nuclei Budget</option>
            <option value="nuclei-intense">Nuclei Intense</option>
            <option value="nuclei-technology">Nuclei Technology</option>
            <option value="paramminer">Parameter Brute-force</option>
            <option value="spider">Web Spider</option>
            <option value="spider-intense">Web Spider Intense</option>
            <option value="subdomain-enum">Subdomain Enumeration</option>
            <option value="tech-detect">Technology Detection</option>
            <option value="web-basic">Basic Web Scan</option>
            <option value="web-screenshots">Web Screenshot Capture</option>
            <option value="web-thorough">Thorough Web Scan</option>
          </select>

          <select id="eventTypeSelect" className="select-field">
            <option value="*" selected>All Events (*)</option>
            <option value="ASN">ASN</option>
            <option value="AZURE_TENANT">Azure Tenant</option>
            <option value="CODE_REPOSITORY">Code Repository</option>
            <option value="DNS_NAME">DNS Name</option>
            <option value="DNS_NAME_UNRESOLVED">Unresolved DNS Name</option>
            <option value="EMAIL_ADDRESS">Email Address</option>
            <option value="FILESYSTEM">Filesystem</option>
            <option value="FINDING">Finding</option>
            <option value="GEOLOCATION">Geolocation</option>
            <option value="HASHED_PASSWORD">Hashed Password</option>
            <option value="HTTP_RESPONSE">HTTP Response</option>
            <option value="IP_ADDRESS">IP Address</option>
            <option value="IP_RANGE">IP Range</option>
            <option value="MOBILE_APP">Mobile App</option>
            <option value="OPEN_TCP_PORT">Open TCP Port</option>
            <option value="ORG_STUB">Organization Stub</option>
            <option value="PASSWORD">Password</option>
            <option value="PROTOCOL">Protocol</option>
            <option value="RAW_DNS_RECORD">Raw DNS Record</option>
            <option value="RAW_TEXT">Raw Text</option>
            <option value="SOCIAL">Social</option>
            <option value="STORAGE_BUCKET">Storage Bucket</option>
            <option value="TECHNOLOGY">Technology</option>
            <option value="URL">URL</option>
            <option value="URL_HINT">URL Hint</option>
            <option value="URL_UNVERIFIED">Unverified URL</option>
            <option value="USERNAME">Username</option>
            <option value="VHOST">Virtual Host (VHOST)</option>
            <option value="VULNERABILITY">Vulnerability</option>
            <option value="WAF">Web Application Firewall (WAF)</option>
            <option value="WEBSCREENSHOT">Web Screenshot</option>
            <option value="WEB_PARAMETER">Web Parameter</option>
          </select>

          <Accordion.Root type="single" collapsible className="accordion-root">
            <Accordion.Item value="advanced" className="accordion-item">
              <Accordion.Trigger className="accordion-trigger">
                Advanced Settings
                <ChevronDown className="accordion-chevron" />
              </Accordion.Trigger>
              <Accordion.Content className="accordion-content">
                <div className="advanced-settings">
                  <div className="select-group">
                    <label>Module Dependencies</label>
                    <select id="modDeps" className="select-field">
                      <option value="--ignore-failed-deps" selected>Ignore Failed Deps</option>
                      <option value="--no-deps">Don't install deps.</option>
                      <option value="--forced-deps">Force</option>
                      <option value="--retry-deps">retry deps</option>
                      <option value="--install-all-deps">install all</option>
                    </select>
                  </div>
                  
                  <div className="select-group">
                    <label>Flag Type</label>
                    <select id="flagSelect" className="select-field">
                      <option value="" selected>N/A</option>
                      <option value="web-thorough">Web Thorough</option>
                      <option value="portscan">Port Scan</option>
                      <option value="service-enum">Service Enumeration</option>
                      <option value="passive">Passive</option>
                      <option value="subdomain-enum">Subdomain Enumeration</option>
                      <option value="web-basic">Web Basic</option>
                      <option value="code-enum">Code Enumeration</option>
                      <option value="social-enum">Social Enumeration</option>
                      <option value="safe">Safe</option>
                      <option value="cloud-enum">Cloud Enumeration</option>
                      <option value="report">Report</option>
                      <option value="baddns">Bad DNS</option>
                      <option value="web-paramminer">Web Parameter Miner</option>
                      <option value="subdomain-hijack">Subdomain Hijack</option>
                      <option value="active">Active</option>
                      <option value="aggressive">Aggressive</option>
                      <option value="email-enum">Email Enumeration</option>
                      <option value="affiliates">Affiliates</option>
                      <option value="web-screenshots">Web Screenshots</option>
                      <option value="slow">Slow</option>
                      <option value="deadly">Deadly</option>
                      <option value="iis-shortnames">IIS Short Names</option>
                    </select>
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input type="checkbox" id="burpsuite" />
                      Use Burp Proxy
                    </label>
                    <label>
                      <input type="checkbox" id="viewPreset" />
                      View Preset
                    </label>
                    <label>
                      <input type="checkbox" id="strictScope" />
                      Strict Scope
                    </label>
                  </div>
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>

          <div className="button-row">
            <div className="button-group">
              <button className="action-button" onClick={() => sendMessage("getOutput")}>
                <Terminal size={14} /> Stream Output
              </button>
              <button className="action-button" onClick={() => sendMessage("getOutfile")}>
                <FileSearch size={14} /> Get Outfiles
              </button>
              <button className="action-button" onClick={() => sendMessage("clearOutput")}>
                <Trash2 size={14} /> Clear Output
              </button>
            </div>
            <div className="button-group">
              <button className="action-button" onClick={() => sendMessage("clearHosts")}>
                <Trash2 size={14} /> Clear Targets
              </button>
              <button className="action-button" onClick={() => sendMessage("getURLS")}>
                <Target size={14} /> Get URLs
              </button>
              <button className="action-button" onClick={() => sendMessage("getHosts")}>
                <Database size={14} /> Scanned Targets
              </button>
            </div>
            <div className="button-group">
              <button className="action-button" onClick={handleToggleStreaming}>
                <Terminal size={14} /> {isStreaming ? "Pause Streaming" : "Resume Streaming"}
              </button>
              <button className="action-button" onClick={() => sendMessage("killScan")}>
                <XCircle size={14} /> Kill Scan
              </button>
              <select id="getSubdomains" className="select-field" onChange={(e) => {
                const selectedPath = e.target.value;
                if (selectedPath) {
                  sendMessage("getSubdomains", { subdomains: selectedPath });
                }
              }}>
                <option value="">Select Subdomain File</option>
                {subdomainFiles.map((file, index) => (
                  <option key={index} value={file}>{file.split('/').slice(-2).join('/')}</option>
                ))}
              </select>
            </div>
            <button className="action-button scan-button" onClick={handleScan}>
              <Play size={14} /> Run Scan
            </button>
          </div>
        </div>
      </div>

      <div className="output-section">
        <div className={`output-container ${isTargetsCollapsed ? 'collapsed' : ''}`} style={{'--current-icon': `url(${outputIcon})`}}>
          <h2 onClick={() => setIsTargetsCollapsed(!isTargetsCollapsed)}>
            <span><Shield size={16} /> Scanned Targets</span>
            <ChevronDown className="chevron" size={16} />
          </h2>
          <pre id="hostsArea" className="hosts-area">{hosts}</pre>
        </div>

        <div className={`output-container ${isOutputCollapsed ? 'collapsed' : ''}`} style={{'--current-icon': `url(${outputIcon})`}}>
          <h2 onClick={() => setIsOutputCollapsed(!isOutputCollapsed)}>
            <span><Shield size={16} /> Scan Output</span>
            <ChevronDown className="chevron" size={16} />
          </h2>
          <div className="tabs">
            <div className={clsx("tab", { active: activeTab === 'raw' })} onClick={() => handleTabChange('raw')}>
              Raw Output
            </div>
            <div className={clsx("tab", { active: activeTab === 'urls' })} onClick={() => handleTabChange('urls')}>
              URLs
            </div>
            <div className={clsx("tab", { active: activeTab === 'outfiles' })} onClick={() => handleTabChange('outfiles')}>
              Outfiles
            </div>
            <div className={clsx("tab", { active: activeTab === 'subdomains' })} onClick={() => handleTabChange('subdomains')}>
              Subdomains
            </div>
          </div>
          <div className={clsx("tab-content", { active: activeTab === 'raw' })}>
            <pre id="results" className="results-container">
              {scanResults || <p className="empty-state">No scan results yet</p>}
            </pre>
          </div>
          <div className={clsx("tab-content", { active: activeTab === 'urls' })}>
            <pre id="urlsOutput" className="results-container">
              {urlsOutput || <p className="empty-state">No URLs extracted yet</p>}
            </pre>
          </div>
          <div className={clsx("tab-content", { active: activeTab === 'outfiles' })}>
            <pre id="outfilesOutput" className="results-container">
              {outfilesOutput || <p className="empty-state">No outfiles extracted yet</p>}
            </pre>
          </div>
          <div className={clsx("tab-content", { active: activeTab === 'subdomains' })}>
            <pre id="subdomainsOutput" className="results-container">
              {subdomainsOutput || <p className="empty-state">No subdomains loaded yet</p>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App