browser.browserAction.onClicked.addListener(() => {
  browser.sidebarAction.toggle()
})

const logOutputs = /(?:\/home\/[^\/]+\/\.bbot\/scans\/[^\/]+\/\S+|\/\S+_output\.txt|\b[A-Za-z0-9._-]+_output\.txt\b)/g
const URL_EVENT_TYPES = new Set(["URL", "URL_HINT", "URL_UNVERIFIED"])
const SUBDOMAIN_EVENT_TYPES = new Set(["DNS_NAME", "DNS_NAME_UNRESOLVED", "VHOST"])
const FALLBACK_EVENT_TYPES = [
  "ASN",
  "AZURE_TENANT",
  "CODE_REPOSITORY",
  "DNS_NAME",
  "DNS_NAME_UNRESOLVED",
  "EMAIL_ADDRESS",
  "FILESYSTEM",
  "FINDING",
  "GEOLOCATION",
  "HASHED_PASSWORD",
  "HTTP_RESPONSE",
  "IP_ADDRESS",
  "IP_RANGE",
  "MOBILE_APP",
  "OPEN_TCP_PORT",
  "ORG_STUB",
  "PASSWORD",
  "PROTOCOL",
  "RAW_DNS_RECORD",
  "RAW_TEXT",
  "SOCIAL",
  "STORAGE_BUCKET",
  "TECHNOLOGY",
  "URL",
  "URL_HINT",
  "URL_UNVERIFIED",
  "USERNAME",
  "VHOST",
  "VULNERABILITY",
  "WAF",
  "WEBSCREENSHOT",
  "WEB_PARAMETER"
]
const DEFAULT_ENVIRONMENT_STATE = {
  hostConfigured: null,
  hostError: "",
  bbotInstalled: false,
  bbotPath: "",
  installedVersion: "",
  latestVersion: "",
  updateAvailable: false,
  status: "checking",
  message: "Checking BBOT status...",
  capabilitiesLoaded: false,
  presets: [],
  modules: [],
  outputModules: [],
  flags: [],
  eventTypes: FALLBACK_EVENT_TYPES
}

let port = null
let scanOutput = ""
let hosts = new Set()
let stream = 1
let environmentState = { ...DEFAULT_ENVIRONMENT_STATE }
const backgroundReady = browser.storage && browser.storage.local && browser.storage.local.get
  ? browser.storage.local.get(["lastScan"]).then(result => {
      if (typeof result.lastScan === "string") {
        scanOutput = result.lastScan
      }
    }).catch(() => {})
  : Promise.resolve()

function normalizeListInput(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[\n,]+/)
  return [...new Set(values.map(entry => String(entry || "").trim()).filter(Boolean))]
}

function emitRuntimeMessage(message) {
  const result = browser.runtime.sendMessage(message)
  if (result && typeof result.catch === "function") {
    result.catch(() => {})
  }
}

function persistLastScan() {
  if (!browser.storage || !browser.storage.local || !browser.storage.local.set) {
    return
  }
  const result = browser.storage.local.set({ lastScan: scanOutput })
  if (result && typeof result.catch === "function") {
    result.catch(() => {})
  }
}

function updateScanOutput(nextOutput) {
  scanOutput = nextOutput
  persistLastScan()
  emitRuntimeMessage({ type: "updateOutput", data: scanOutput })
}

function appendScanOutput(line) {
  scanOutput += `${line}\n`
  persistLastScan()
  if (stream === 1) {
    emitRuntimeMessage({ type: "updateOutput", data: scanOutput })
  }
}

function setEnvironmentState(nextState) {
  environmentState = nextState
  emitRuntimeMessage({ type: "environmentStateUpdated", data: environmentState })
}

function mergeEnvironmentState(patch) {
  setEnvironmentState({ ...environmentState, ...patch })
}

function missingHostState(errorMessage = "") {
  return {
    ...DEFAULT_ENVIRONMENT_STATE,
    hostConfigured: false,
    hostError: errorMessage,
    status: "host-missing",
    message: "Native host is not configured. On Linux run the installer from a BBOT-Xtension checkout, then reopen Firefox."
  }
}

function normalizeStatusResponse(response) {
  const data = response && response.data ? response.data : {}
  return {
    ...environmentState,
    hostConfigured: true,
    hostError: "",
    bbotInstalled: Boolean(data.bbotInstalled),
    bbotPath: data.bbotPath || "",
    installedVersion: data.installedVersion || "",
    latestVersion: data.latestVersion || "",
    updateAvailable: Boolean(data.updateAvailable),
    status: data.status || "ready",
    message: data.message || "",
    capabilitiesLoaded: Boolean(environmentState.capabilitiesLoaded && data.bbotInstalled)
  }
}

function normalizeCapabilitiesResponse(response) {
  const data = response && response.data ? response.data : {}
  return {
    presets: Array.isArray(data.presets) ? data.presets : [],
    modules: Array.isArray(data.modules) ? data.modules : [],
    outputModules: Array.isArray(data.outputModules) ? data.outputModules : [],
    flags: Array.isArray(data.flags) ? data.flags : [],
    eventTypes: Array.isArray(data.eventTypes) && data.eventTypes.length > 0 ? data.eventTypes : FALLBACK_EVENT_TYPES
  }
}

async function refreshCapabilities() {
  if (!environmentState.hostConfigured || !environmentState.bbotInstalled) {
    mergeEnvironmentState({
      capabilitiesLoaded: false,
      presets: [],
      modules: [],
      outputModules: [],
      flags: [],
      eventTypes: FALLBACK_EVENT_TYPES
    })
    return environmentState
  }

  try {
    const response = await browser.runtime.sendNativeMessage("bbot_host", { command: "getCapabilities" })
    const capabilities = normalizeCapabilitiesResponse(response)
    mergeEnvironmentState({
      capabilitiesLoaded: true,
      presets: capabilities.presets,
      modules: capabilities.modules,
      outputModules: capabilities.outputModules,
      flags: capabilities.flags,
      eventTypes: capabilities.eventTypes
    })
  } catch (error) {
    mergeEnvironmentState({
      capabilitiesLoaded: false,
      presets: [],
      modules: [],
      outputModules: [],
      flags: [],
      eventTypes: FALLBACK_EVENT_TYPES
    })
  }

  return environmentState
}

async function refreshEnvironmentState() {
  if (environmentState.hostConfigured !== null) {
    mergeEnvironmentState({
      status: "checking",
      message: "Checking BBOT status..."
    })
  }

  try {
    const response = await browser.runtime.sendNativeMessage("bbot_host", { command: "getStatus" })
    setEnvironmentState(normalizeStatusResponse(response))
    if (environmentState.bbotInstalled) {
      await refreshCapabilities()
    } else {
      mergeEnvironmentState({
        capabilitiesLoaded: false,
        presets: [],
        modules: [],
        outputModules: [],
        flags: [],
        eventTypes: FALLBACK_EVENT_TYPES
      })
    }
  } catch (error) {
    const errorMessage = error && error.message ? error.message : ""
    setEnvironmentState(missingHostState(errorMessage))
  }

  return environmentState
}

function connectNative() {
  if (port) {
    return port
  }

  try {
    port = browser.runtime.connectNative("bbot_host")
  } catch (error) {
    setEnvironmentState(missingHostState(error && error.message ? error.message : ""))
    return null
  }

  port.onMessage.addListener(message => {
    if (message.type === "scanResult") {
      appendScanOutput(message.data)
    } else if (message.type === "info") {
      appendScanOutput(`[INFO] ${message.data}`)
      if (message.data.includes("Scan completed.")) {
        refreshDerivedOutputs()
      }
    } else if (message.type === "error") {
      appendScanOutput(`[ERROR] ${message.data}`)
    } else if (message.type === "deployComplete") {
      const nextState = normalizeStatusResponse({ data: message.data })
      setEnvironmentState(nextState)
      appendScanOutput("[INFO] Deployment completed.")
      if (nextState.bbotInstalled) {
        refreshCapabilities()
      }
    }
  })

  port.onDisconnect.addListener(() => {
    const errorMessage = browser.runtime.lastError && browser.runtime.lastError.message
      ? browser.runtime.lastError.message
      : ""
    port = null
    if (errorMessage) {
      setEnvironmentState(missingHostState(errorMessage))
    }
  })

  return port
}

function extractOutputPaths(output) {
  const outputs = output.match(logOutputs) || []
  return [...new Set(outputs)]
}

function buildListOutput(title, items) {
  return items.length > 0 ? `${title}\n${items.join("\n")}` : ""
}

function eventPrimaryText(event) {
  if (!event) {
    return ""
  }

  if (typeof event.data === "string") {
    return event.data
  }

  if (typeof event.host === "string") {
    return event.host
  }

  if (typeof event.netloc === "string") {
    return event.netloc
  }

  if (event.data && typeof event.data === "object") {
    for (const key of ["url", "host", "name", "value"]) {
      if (typeof event.data[key] === "string") {
        return event.data[key]
      }
    }
  }

  return ""
}

function parseStructuredScanEvents(contents) {
  const events = []
  for (const line of (contents || "").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    try {
      events.push(JSON.parse(trimmed))
    } catch (error) {
    }
  }
  return events
}

function buildUrlsOutput(events) {
  const urls = []
  const seen = new Set()

  for (const event of events) {
    if (!URL_EVENT_TYPES.has(event.type)) {
      continue
    }
    const value = eventPrimaryText(event)
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    urls.push(value)
  }

  if (urls.length > 0) {
    return `URLs:\n${urls.join("\n")}`
  }

  if (events.length > 0) {
    return "No URL events captured for this scan."
  }

  return ""
}

function buildSubdomainsOutput(events) {
  const subdomains = []
  const seen = new Set()

  for (const event of events) {
    if (!SUBDOMAIN_EVENT_TYPES.has(event.type)) {
      continue
    }

    const value = eventPrimaryText(event)
    if (!value) {
      continue
    }

    const resolvedHosts = Array.isArray(event.resolved_hosts)
      ? [...new Set(event.resolved_hosts.filter(Boolean))]
      : []
    const formatted = resolvedHosts.length > 0
      ? `${value} | ${resolvedHosts.join(", ")}`
      : value

    if (seen.has(formatted)) {
      continue
    }

    seen.add(formatted)
    subdomains.push(formatted)
  }

  if (subdomains.length > 0) {
    return `Subdomains:\n${subdomains.join("\n")}`
  }

  if (events.length > 0) {
    return "No DNS/subdomain events captured for this scan."
  }

  return ""
}

async function readNativeFile(path) {
  const response = await browser.runtime.sendNativeMessage("bbot_host", { command: "readFile", path })
  if (response.error) {
    throw new Error(response.error)
  }
  return response.data
}

async function refreshDerivedOutputs() {
  await backgroundReady

  const outputPaths = extractOutputPaths(scanOutput)
  emitRuntimeMessage({ type: "updateOutfiles", data: buildListOutput("Extracted Outfile:", outputPaths) })

  const jsonPaths = outputPaths.filter(path => /\/output\.json$/i.test(path))
  if (jsonPaths.length === 0) {
    emitRuntimeMessage({ type: "updateURLs", data: "" })
    emitRuntimeMessage({ type: "updateSubdomains", data: "" })
    return { ok: true }
  }

  const fileContents = await Promise.all(
    jsonPaths.map(path => readNativeFile(path).catch(() => ""))
  )
  const events = fileContents.flatMap(parseStructuredScanEvents)

  emitRuntimeMessage({ type: "updateURLs", data: buildUrlsOutput(events) })
  emitRuntimeMessage({ type: "updateSubdomains", data: buildSubdomainsOutput(events) })

  return { ok: true }
}

async function fetchSubdomains(filePath) {
  try {
    const response = await browser.runtime.sendNativeMessage("bbot_host", { command: "getSubdomains", subdomains: filePath })
    if (response.error) {
      throw new Error(response.error)
    }
    return response.data
  } catch (error) {
    throw new Error("Error communicating with bbot_host.")
  }
}

async function ensureEnvironmentReady() {
  if (environmentState.hostConfigured === null || environmentState.status === "checking") {
    await refreshEnvironmentState()
  }
  return environmentState.hostConfigured && environmentState.bbotInstalled
}

async function handleDeployRequest() {
  if (environmentState.hostConfigured === null) {
    await refreshEnvironmentState()
  }

  if (!environmentState.hostConfigured) {
    appendScanOutput(`[ERROR] ${environmentState.message}`)
    return { ok: false, reason: "host-missing" }
  }

  const activePort = connectNative()
  if (!activePort) {
    appendScanOutput(`[ERROR] ${environmentState.message}`)
    return { ok: false, reason: "host-missing" }
  }

  const result = await browser.storage.local.get("deployScriptPath")
  appendScanOutput(`[INFO] ${environmentState.updateAvailable ? "Updating BBOT..." : "Deploying BBOT..."}`)
  activePort.postMessage({
    command: "deploy",
    deployDir: result.deployScriptPath || ""
  })
  return { ok: true }
}

async function handleRunScan(msg) {
  const ready = await ensureEnvironmentReady()
  if (!ready) {
    appendScanOutput(`[ERROR] ${environmentState.message}`)
    return { ok: false, reason: "environment-not-ready" }
  }

  const activePort = connectNative()
  if (!activePort) {
    appendScanOutput(`[ERROR] ${environmentState.message}`)
    return { ok: false, reason: "host-missing" }
  }

  const targets = normalizeListInput(Array.isArray(msg.targets) && msg.targets.length > 0 ? msg.targets : msg.target)
  const whitelist = normalizeListInput(msg.whitelist)
  const blacklist = normalizeListInput(msg.blacklist)
  const modules = normalizeListInput(msg.modules)
  const excludedModules = normalizeListInput(msg.excludedModules)
  const flags = normalizeListInput(msg.flags)
  if (msg.flagType) {
    flags.unshift(msg.flagType)
  }
  const normalizedFlags = [...new Set(flags.filter(Boolean))]
  const requiredFlags = normalizeListInput(msg.requiredFlags)
  const excludedFlags = normalizeListInput(msg.excludedFlags)
  const outputModules = normalizeListInput(msg.outputModules)
  const scanName = String(msg.scanName || "").trim()
  if (targets.length === 0) {
    appendScanOutput("[ERROR] Target is required")
    return { ok: false, reason: "missing-target" }
  }

  targets.forEach(target => hosts.add(target))
  const eventType = msg.eventType && msg.eventType !== "*" ? msg.eventType : ""

  activePort.postMessage({
    command: "scan",
    target: targets[0],
    targets,
    whitelist,
    blacklist,
    modules,
    excludedModules,
    flags: normalizedFlags,
    requiredFlags,
    excludedFlags,
    outputModules,
    scanName,
    scantype: msg.scanType,
    deadly: msg.deadly,
    eventtype: eventType,
    moddep: msg.moddep,
    flagtype: "",
    burp: msg.burp,
    viewtype: msg.viewtype,
    scope: msg.scope
  })

  return { ok: true }
}

browser.runtime.onMessage.addListener(msg => {
  if (msg.type === "getEnvironmentState") {
    return Promise.resolve(environmentState)
  }

  if (msg.type === "refreshEnvironmentState") {
    return refreshEnvironmentState()
  }

  if (msg.type === "deployBbot") {
    return handleDeployRequest()
  }

  if (msg.type === "runScan") {
    return handleRunScan(msg)
  }

  if (msg.type === "getOutput") {
    stream = 1
    emitRuntimeMessage({ type: "updateOutput", data: scanOutput })
    return Promise.resolve({ ok: true })
  }

  if (msg.type === "getHosts") {
    emitRuntimeMessage({ type: "updateHosts", data: Array.from(hosts).join("\n") })
    return Promise.resolve({ ok: true })
  }

  if (msg.type === "clearOutput") {
    updateScanOutput("")
    emitRuntimeMessage({ type: "updateURLs", data: "" })
    emitRuntimeMessage({ type: "updateOutfiles", data: "" })
    emitRuntimeMessage({ type: "updateSubdomains", data: "" })
    return Promise.resolve({ ok: true })
  }

  if (msg.type === "clearHosts") {
    hosts.clear()
    emitRuntimeMessage({ type: "updateHosts", data: "" })
    return Promise.resolve({ ok: true })
  }

  if (msg.type === "getURLS") {
    return refreshDerivedOutputs()
  }

  if (msg.type === "getOutfile") {
    return refreshDerivedOutputs()
  }

  if (msg.type === "killScan") {
    const activePort = connectNative()
    if (activePort) {
      activePort.postMessage({ command: "killScan" })
    }
    return Promise.resolve({ ok: true })
  }

  if (msg.type === "getSubdomains") {
    return fetchSubdomains(msg.subdomains)
      .then(data => {
        emitRuntimeMessage({ type: "updateSubdomains", data })
        return { ok: true }
      })
      .catch(error => {
        emitRuntimeMessage({ type: "updateSubdomains", data: error.message })
        return { ok: false }
      })
  }

  if (msg.type === "toggleStream") {
    stream = msg.stream ? 1 : 0
    if (stream === 1) {
      emitRuntimeMessage({ type: "updateOutput", data: scanOutput })
    }
    return Promise.resolve({ ok: true })
  }

  return false
})
  