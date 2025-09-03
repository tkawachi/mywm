describe('Background Script', () => {
  let mockChrome;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Setup Chrome API mocks
    mockChrome = {
      tabs: {
        onCreated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
        query: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        move: jest.fn(),
        group: jest.fn(),
        ungroup: jest.fn()
      },
      windows: {
        onCreated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
        getCurrent: jest.fn(),
        getAll: jest.fn(),
        update: jest.fn(),
        create: jest.fn()
      },
      runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        getURL: jest.fn(path => `chrome-extension://test-id/${path}`)
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
    
    global.chrome = mockChrome;
  });

  describe('Auto-refresh functionality', () => {
    test('should register all event listeners on load', () => {
      require('../background.js');
      
      expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.windows.onCreated.addListener).toHaveBeenCalled();
      expect(chrome.windows.onRemoved.addListener).toHaveBeenCalled();
    });

    test('notifyUIRefresh should send autoRefresh message', () => {
      chrome.runtime.sendMessage.mockReturnValue(Promise.resolve());
      
      // Import and get the notifyUIRefresh function
      require('../background.js');
      const onCreatedHandler = chrome.tabs.onCreated.addListener.mock.calls[0][0];
      
      // Trigger the handler which calls notifyUIRefresh
      onCreatedHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'autoRefresh' });
    });

    test('should handle autoRefresh message errors gracefully', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => 
        Promise.reject(new Error('No listener'))
      );
      
      require('../background.js');
      const onCreatedHandler = chrome.tabs.onCreated.addListener.mock.calls[0][0];
      
      // Should not throw even if sendMessage fails
      await expect(async () => {
        await onCreatedHandler();
      }).not.toThrow();
    });
  });

  describe('openOrFocusManager', () => {
    test('should focus existing manager tab if open', async () => {
      const existingTab = { id: 123, windowId: 456 };
      chrome.tabs.query.mockResolvedValue([existingTab]);
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});
      
      require('../background.js');
      const onClickedHandler = chrome.action.onClicked.addListener.mock.calls[0][0];
      
      await onClickedHandler();
      
      // Wait for all promises to resolve
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(chrome.tabs.query).toHaveBeenCalledWith({ 
        url: 'chrome-extension://test-id/manager.html' 
      });
      expect(chrome.tabs.update).toHaveBeenCalledWith(123, { active: true });
      expect(chrome.windows.update).toHaveBeenCalledWith(456, { focused: true });
    });

    test('should create new manager tab if none exists', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({});
      
      require('../background.js');
      const onClickedHandler = chrome.action.onClicked.addListener.mock.calls[0][0];
      
      await onClickedHandler();
      
      expect(chrome.tabs.create).toHaveBeenCalledWith({ 
        url: 'chrome-extension://test-id/manager.html' 
      });
    });
  });

  describe('Keyboard shortcuts', () => {
    test('should handle open-manager command', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({});
      
      require('../background.js');
      const onCommandHandler = chrome.commands.onCommand.addListener.mock.calls[0][0];
      
      await onCommandHandler('open-manager');
      
      expect(chrome.tabs.create).toHaveBeenCalledWith({ 
        url: 'chrome-extension://test-id/manager.html' 
      });
    });

    test('should handle sort-tabs command', async () => {
      const mockWindow = {
        id: 1,
        tabs: [
          { id: 1, url: 'https://google.com/search' },
          { id: 2, url: 'https://apple.com/products' },
          { id: 3, url: 'https://google.com/mail' }
        ]
      };
      
      chrome.windows.getCurrent.mockResolvedValue(mockWindow);
      chrome.tabs.move.mockResolvedValue({});
      chrome.notifications.create.mockImplementation((options, callback) => {
        if (callback) callback('notification-id');
      });
      
      require('../background.js');
      const onCommandHandler = chrome.commands.onCommand.addListener.mock.calls[0][0];
      
      await onCommandHandler('sort-tabs');
      
      // Verify tabs are sorted by domain
      expect(chrome.tabs.move).toHaveBeenCalled();
      expect(chrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          title: 'Tabs Sorted',
          message: expect.stringContaining('3 tabs')
        })
      );
    });
  });

  describe('Message handlers', () => {
    test('should handle getAllWindows message', async () => {
      const mockWindows = [
        { id: 1, tabs: [] },
        { id: 2, tabs: [] }
      ];
      chrome.windows.getAll.mockResolvedValue(mockWindows);
      
      require('../background.js');
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      const sendResponse = jest.fn();
      const returnValue = messageHandler(
        { action: 'getAllWindows' },
        {},
        sendResponse
      );
      
      expect(returnValue).toBe(true); // Should return true for async response
      
      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(chrome.windows.getAll).toHaveBeenCalledWith({ populate: true });
    });

    test('should handle closeTab message', () => {
      require('../background.js');
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      messageHandler({ action: 'closeTab', tabId: 123 }, {}, jest.fn());
      
      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });

    test('should handle focusTab message', () => {
      require('../background.js');
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      messageHandler(
        { action: 'focusTab', tabId: 123, windowId: 456 },
        {},
        jest.fn()
      );
      
      expect(chrome.tabs.update).toHaveBeenCalledWith(123, { active: true });
      expect(chrome.windows.update).toHaveBeenCalledWith(456, { focused: true });
    });

    test('should handle moveTabToWindow message', () => {
      require('../background.js');
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      messageHandler(
        { action: 'moveTabToWindow', tabId: 123, targetWindowId: 456 },
        {},
        jest.fn()
      );
      
      expect(chrome.tabs.move).toHaveBeenCalledWith(123, { 
        windowId: 456, 
        index: -1 
      });
    });
  });
});