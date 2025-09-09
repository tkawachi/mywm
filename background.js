
// Auto-refresh event listeners
chrome.tabs.onCreated.addListener(() => {
  notifyUIRefresh();
});

chrome.tabs.onRemoved.addListener(() => {
  notifyUIRefresh();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only refresh on meaningful changes (URL, title, or status changes)
  if (changeInfo.url || changeInfo.title || changeInfo.status === 'complete') {
    notifyUIRefresh();
  }
});

chrome.windows.onCreated.addListener(() => {
  notifyUIRefresh();
});

chrome.windows.onRemoved.addListener(() => {
  notifyUIRefresh();
});

function notifyUIRefresh() {
  // Send message to all manager pages to refresh
  chrome.runtime.sendMessage({ action: 'autoRefresh' }).catch(() => {
    // Ignore errors if no manager page is open
  });
}

async function openOrFocusManager() {
  try {
    const managerUrl = chrome.runtime.getURL('manager.html');
    const tabs = await chrome.tabs.query({ url: managerUrl });
    
    if (tabs.length > 0) {
      // Manager tab already exists, focus it
      const tab = tabs[0];
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    } else {
      // Create new manager tab
      await chrome.tabs.create({ url: managerUrl });
    }
  } catch (error) {
    console.error('Error opening/focusing manager:', error);
  }
}

chrome.action.onClicked.addListener(() => {
  openOrFocusManager();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'sort-tabs') {
    await sortCurrentWindow();
  } else if (command === 'open-manager') {
    await openOrFocusManager();
  }
});

async function sortCurrentWindow() {
  try {
    const currentWindow = await chrome.windows.getCurrent({ populate: true });
    const sortedTabs = currentWindow.tabs.slice().sort((a, b) => {
      const aValue = a.url.toLowerCase();
      const bValue = b.url.toLowerCase();
      return aValue.localeCompare(bValue);
    });
    
    const sortedTabIds = sortedTabs.map(tab => tab.id);
    await sortTabsInWindow(currentWindow.id, sortedTabIds);
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: 'Tabs Sorted',
      message: `Sorted ${sortedTabs.length} tabs by URL`
    });
  } catch (error) {
    console.error('Error sorting current window:', error);
  }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAllWindows') {
    getAllWindows().then(windows => sendResponse(windows));
    return true;
  } else if (request.action === 'closeTab') {
    chrome.tabs.remove(request.tabId);
  } else if (request.action === 'focusTab') {
    chrome.tabs.update(request.tabId, { active: true });
    chrome.windows.update(request.windowId, { focused: true });
  } else if (request.action === 'moveTabToWindow') {
    chrome.tabs.move(request.tabId, { windowId: request.targetWindowId, index: -1 });
  } else if (request.action === 'sortTabsInWindow') {
    sortTabsInWindow(request.windowId, request.sortedTabIds);
    return true;
  } else if (request.action === 'sortAllWindows') {
    sortAllWindows();
    return true;
  } else if (request.action === 'removeDuplicates') {
    removeDuplicateTabs().then(result => sendResponse(result));
    return true;
  }
});

async function getAllWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  // Filter out Picture-in-Picture windows (which are always on top) and Chrome app windows
  const filteredWindows = windows.filter(window => {
    // Exclude Picture-in-Picture windows
    if (window.alwaysOnTop) return false;
    
    // Exclude Chrome app windows (type 'app' or 'popup')
    // Normal browser windows have type 'normal'
    if (window.type !== 'normal') return false;
    
    return true;
  });
  return filteredWindows.map(window => ({
    id: window.id,
    focused: window.focused,
    tabs: window.tabs.map(tab => ({
      id: tab.id,
      windowId: window.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      active: tab.active,
      audible: tab.audible,
      mutedInfo: tab.mutedInfo,
      pinned: tab.pinned
    }))
  }));
}


async function sortTabsInWindow(windowId, sortedTabIds) {
  try {
    for (let i = 0; i < sortedTabIds.length; i++) {
      await chrome.tabs.move(sortedTabIds[i], { windowId: windowId, index: i });
    }
  } catch (error) {
    console.error('Error sorting tabs:', error);
  }
}

async function sortAllWindows() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    
    for (const window of windows) {
      // Skip Picture-in-Picture windows
      if (window.alwaysOnTop) continue;
      
      // Skip Chrome app windows (only process normal browser windows)
      if (window.type !== 'normal') continue;
      
      // Always sort by URL
      const sortedTabs = window.tabs.slice().sort((a, b) => {
        const aValue = a.url.toLowerCase();
        const bValue = b.url.toLowerCase();
        return aValue.localeCompare(bValue);
      });
      
      const sortedTabIds = sortedTabs.map(tab => tab.id);
      await sortTabsInWindow(window.id, sortedTabIds);
    }
  } catch (error) {
    console.error('Error sorting all windows:', error);
  }
}

async function removeDuplicateTabs() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const urlMap = new Map();
    const tabsToClose = [];
    
    // Collect all tabs and track duplicates
    for (const window of windows) {
      // Skip Chrome app windows (only process normal browser windows)
      if (window.type !== 'normal') continue;
      
      for (const tab of window.tabs) {
        const url = tab.url;
        
        if (urlMap.has(url)) {
          // Found duplicate - keep the first one, mark others for removal
          const existingTab = urlMap.get(url);
          
          // Prefer active tab over inactive tab
          if (tab.active && !existingTab.active) {
            tabsToClose.push(existingTab.id);
            urlMap.set(url, tab);
          } else {
            tabsToClose.push(tab.id);
          }
        } else {
          urlMap.set(url, tab);
        }
      }
    }
    
    // Close duplicate tabs
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'Duplicates Removed',
        message: `Removed ${tabsToClose.length} duplicate tab${tabsToClose.length !== 1 ? 's' : ''}`
      });
    }
    
    return { removedCount: tabsToClose.length };
  } catch (error) {
    console.error('Error removing duplicate tabs:', error);
    return { error: error.message };
  }
}