describe('Manager Page', () => {
  let mockChrome;
  let document;

  beforeEach(() => {
    // Setup DOM
    document = global.document;
    document.body.innerHTML = `
      <div id="windowsList"></div>
      <div id="windowCount"></div>
      <button id="mergeAllBtn"></button>
      <button id="executeSortBtn"></button>
      <button id="removeDuplicatesBtn"></button>
    `;

    // Setup Chrome API mocks
    mockChrome = {
      runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() }
      },
      windows: {
        remove: jest.fn(),
        getAll: jest.fn(),
        getCurrent: jest.fn(),
        update: jest.fn()
      },
      tabs: {
        remove: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        move: jest.fn()
      }
    };
    
    global.chrome = mockChrome;
    
    // Clear module cache to ensure fresh import
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should load windows and setup listeners on DOMContentLoaded', () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback([
            { id: 1, tabs: [{ id: 1, title: 'Tab 1', url: 'https://example.com' }] }
          ]);
        }
      });

      require('../manager.js');
      
      // Trigger DOMContentLoaded
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getAllWindows' },
        expect.any(Function)
      );
      
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('Window rendering', () => {
    test('should display empty state when no windows', () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback([]);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const container = document.getElementById('windowsList');
      expect(container.innerHTML).toContain('No windows open');
    });

    test('should render window cards with tabs', () => {
      const mockWindows = [
        {
          id: 1,
          tabs: [
            { id: 1, title: 'Google', url: 'https://google.com', favIconUrl: '' },
            { id: 2, title: 'GitHub', url: 'https://github.com', favIconUrl: '' }
          ]
        }
      ];

      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback(mockWindows);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const container = document.getElementById('windowsList');
      expect(container.querySelector('.window-card')).toBeTruthy();
      expect(container.querySelector('.window-title').textContent).toBe('Window 1');
      expect(container.querySelector('.tab-count').textContent).toBe('2');
    });

    test('should group tabs by domain', () => {
      const mockWindows = [
        {
          id: 1,
          tabs: [
            { id: 1, title: 'Google Search', url: 'https://google.com/search', favIconUrl: '' },
            { id: 2, title: 'Google Mail', url: 'https://google.com/mail', favIconUrl: '' },
            { id: 3, title: 'GitHub', url: 'https://github.com', favIconUrl: '' }
          ]
        }
      ];

      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback(mockWindows);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const container = document.getElementById('windowsList');
      const domainGroups = container.querySelectorAll('.domain-group');
      
      // Should have 2 domain groups (google.com and github.com)
      expect(domainGroups.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-refresh', () => {
    test('should handle autoRefresh message', () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback([]);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      // Clear previous calls
      chrome.runtime.sendMessage.mockClear();
      
      // Trigger auto-refresh
      messageHandler({ action: 'autoRefresh' }, {}, jest.fn());
      
      // Should reload windows
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'getAllWindows' },
        expect.any(Function)
      );
    });

    test('should preserve scroll position on refresh', (done) => {
      const mockWindows = [
        {
          id: 1,
          tabs: Array(20).fill(null).map((_, i) => ({
            id: i,
            title: `Tab ${i}`,
            url: `https://example${i}.com`,
            favIconUrl: ''
          }))
        }
      ];

      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback(mockWindows);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const container = document.getElementById('windowsList');
      
      // Mock scrollTop and scrollLeft properties
      let scrollTopValue = 100;
      let scrollLeftValue = 50;
      
      Object.defineProperty(container, 'scrollTop', {
        get: () => scrollTopValue,
        set: (value) => { scrollTopValue = value; },
        configurable: true
      });
      
      Object.defineProperty(container, 'scrollLeft', {
        get: () => scrollLeftValue,
        set: (value) => { scrollLeftValue = value; },
        configurable: true
      });
      
      // Set initial scroll position
      container.scrollTop = 100;
      container.scrollLeft = 50;
      
      // Trigger refresh
      const messageHandler = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      messageHandler({ action: 'autoRefresh' }, {}, jest.fn());
      
      // Wait for Promise.resolve() microtask and next event loop tick
      Promise.resolve().then(() => {
        setTimeout(() => {
          // Scroll position should be preserved after microtask
          expect(container.scrollTop).toBe(100);
          expect(container.scrollLeft).toBe(50);
          done();
        }, 0);
      });
    });
  });

  describe('User actions', () => {
    test('should handle merge all windows button click', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback([]);
        }
      });
      
      // Mock chrome.windows.getAll and getCurrent for mergeAllWindows function
      chrome.windows.getAll.mockResolvedValue([
        { id: 1, tabs: [{ id: 1 }] },
        { id: 2, tabs: [{ id: 2 }] }
      ]);
      chrome.windows.getCurrent.mockResolvedValue({ id: 1 });
      chrome.tabs.create.mockResolvedValue({});

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const mergeBtn = document.getElementById('mergeAllBtn');
      await mergeBtn.click();
      
      // Should call chrome.windows.getAll to get all windows for merging
      expect(chrome.windows.getAll).toHaveBeenCalled();
    });

    test('should handle sort all windows button click', () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback([{ id: 1, tabs: [] }]);
        } else if (msg.action === 'sortAllWindows') {
          callback({ success: true });
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const sortBtn = document.getElementById('executeSortBtn');
      sortBtn.click();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'sortAllWindows' },
        expect.any(Function)
      );
    });

    test('should handle remove duplicates button click', () => {
      const mockWindows = [
        {
          id: 1,
          tabs: [
            { id: 1, title: 'Google', url: 'https://google.com', favIconUrl: '' },
            { id: 2, title: 'Google', url: 'https://google.com', favIconUrl: '' },
            { id: 3, title: 'GitHub', url: 'https://github.com', favIconUrl: '' }
          ]
        }
      ];

      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback(mockWindows);
        } else if (msg.action === 'removeDuplicates') {
          // Simulate the background script's response
          callback({ removedCount: 1, tabsToClose: [2] });
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const removeDupsBtn = document.getElementById('removeDuplicatesBtn');
      removeDupsBtn.click();
      
      // Should send removeDuplicates message to background script
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'removeDuplicates' },
        expect.any(Function)
      );
    });

    test('should handle window close button click', () => {
      const mockWindows = [
        {
          id: 123,
          tabs: [
            { id: 1, title: 'Tab 1', url: 'https://example.com', favIconUrl: '' }
          ]
        }
      ];

      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback(mockWindows);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const closeBtn = document.querySelector('.close-icon');
      closeBtn.click();
      
      expect(chrome.windows.remove).toHaveBeenCalledWith(123);
    });
  });

  describe('Window count', () => {
    test('should update window count display', () => {
      const mockWindows = [
        { id: 1, tabs: [{ id: 1, title: 'Tab 1', url: 'https://example.com' }] },
        { id: 2, tabs: [{ id: 2, title: 'Tab 2', url: 'https://example.com' }] }
      ];

      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg.action === 'getAllWindows') {
          callback(mockWindows);
        }
      });

      require('../manager.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      const windowCount = document.getElementById('windowCount');
      expect(windowCount.textContent).toContain('2');
    });
  });
});