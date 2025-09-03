// Setup Chrome API mocks for testing
global.chrome = {
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://extension-id/${path}`),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    move: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    onCreated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() }
  },
  windows: {
    getAll: jest.fn(),
    getCurrent: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    onCreated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() }
  },
  action: {
    onClicked: { addListener: jest.fn() }
  },
  commands: {
    onCommand: { addListener: jest.fn() }
  },
  notifications: {
    create: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};