let savedWindows = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['savedWindows'], (result) => {
    if (result.savedWindows) {
      savedWindows = result.savedWindows;
    }
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-window') {
    await saveCurrentWindow();
  } else if (command === 'search-tabs') {
    chrome.action.openPopup();
  }
});

async function saveCurrentWindow() {
  const window = await chrome.windows.getCurrent({ populate: true });
  const savedWindow = {
    id: Date.now(),
    name: `Window ${new Date().toLocaleString()}`,
    tabs: window.tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      pinned: tab.pinned
    }))
  };
  
  savedWindows.push(savedWindow);
  await chrome.storage.local.set({ savedWindows });
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Window Saved',
    message: `Saved ${window.tabs.length} tabs`
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSavedWindows') {
    sendResponse(savedWindows);
  } else if (request.action === 'restoreWindow') {
    restoreWindow(request.windowId);
  } else if (request.action === 'deleteWindow') {
    deleteSavedWindow(request.windowId);
  } else if (request.action === 'getAllWindows') {
    getAllWindows().then(windows => sendResponse(windows));
    return true;
  } else if (request.action === 'searchTabs') {
    searchTabs(request.query).then(tabs => sendResponse(tabs));
    return true;
  } else if (request.action === 'closeTab') {
    chrome.tabs.remove(request.tabId);
  } else if (request.action === 'focusTab') {
    chrome.tabs.update(request.tabId, { active: true });
    chrome.windows.update(request.windowId, { focused: true });
  } else if (request.action === 'moveTabToWindow') {
    chrome.tabs.move(request.tabId, { windowId: request.targetWindowId, index: -1 });
  }
});

async function getAllWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  return windows.map(window => ({
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

async function searchTabs(query) {
  const windows = await chrome.windows.getAll({ populate: true });
  const allTabs = [];
  
  windows.forEach(window => {
    window.tabs.forEach(tab => {
      if (tab.title.toLowerCase().includes(query.toLowerCase()) ||
          tab.url.toLowerCase().includes(query.toLowerCase())) {
        allTabs.push({
          id: tab.id,
          windowId: window.id,
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl
        });
      }
    });
  });
  
  return allTabs;
}

async function restoreWindow(windowId) {
  const savedWindow = savedWindows.find(w => w.id === windowId);
  if (savedWindow) {
    const urls = savedWindow.tabs.map(tab => tab.url);
    chrome.windows.create({ url: urls });
  }
}

function deleteSavedWindow(windowId) {
  savedWindows = savedWindows.filter(w => w.id !== windowId);
  chrome.storage.local.set({ savedWindows });
}