import { readFileSync } from 'fs'
import { join } from 'path'
import vm from 'vm'

function loadBackground(browserMock) {
  const code = readFileSync(join(process.cwd(), 'background.js'), 'utf8')
  const sandbox = { browser: browserMock, console, module: {} }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox
}

describe('background message handling', () => {
  it('responds to getOutput', async () => {
    let listener
    const sendMessage = vi.fn()
    const browserMock = {
      browserAction: { onClicked: { addListener: vi.fn() } },
      sidebarAction: { toggle: vi.fn() },
      runtime: {
        connectNative: vi.fn().mockReturnValue({
          onMessage: { addListener: vi.fn() },
          onDisconnect: { addListener: vi.fn() },
          postMessage: vi.fn()
        }),
        onMessage: { addListener: fn => { listener = fn } },
        sendMessage,
        sendNativeMessage: vi.fn().mockResolvedValue({})
      },
      storage: { local: { get: vi.fn().mockResolvedValue({}) } }
    }
    loadBackground(browserMock)
    listener({ type: 'getOutput' })
    expect(sendMessage).toHaveBeenCalledWith({ type: 'updateOutput', data: '' })
  })
})