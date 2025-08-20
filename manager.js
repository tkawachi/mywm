let currentWindows = [];
let savedWindows = [];
let currentView = 'active';
let sortBy = 'domain';

document.addEventListener('DOMContentLoaded', () => {
  loadActiveWindows();
  loadSavedWindows();
  setupEventListeners();
  updateWindowCount();
});

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = e.currentTarget.dataset.view;
      if (view) {
        switchView(view);
      }
    });
  });

  // Toolbar buttons
  document.getElementById('refreshBtn').addEventListener('click', refresh);
  document.getElementById('mergeAllBtn').addEventListener('click', mergeAllWindows);
  document.getElementById('saveAllBtn').addEventListener('click', saveAllWindows);
  document.getElementById('listViewBtn').addEventListener('click', () => setViewMode('list'));
  document.getElementById('gridViewBtn').addEventListener('click', () => setViewMode('grid'));
  
  // Global search
  document.getElementById('globalSearch').addEventListener('input', (e) => {
    searchTabs(e.target.value);
  });

  // Sort controls
  document.getElementById('sortBy').addEventListener('change', (e) => {
    sortBy = e.target.value;
    applySorting();
  });

  document.getElementById('executeSortBtn').addEventListener('click', () => {
    executeSortOnAllWindows();
  });

  // Settings
  document.getElementById('darkMode').addEventListener('change', (e) => {
    document.body.classList.toggle('dark-mode', e.target.checked);
    chrome.storage.local.set({ darkMode: e.target.checked });
  });

  // Load settings
  chrome.storage.local.get(['darkMode'], (result) => {
    if (result.darkMode) {
      document.getElementById('darkMode').checked = true;
      document.body.classList.add('dark-mode');
    }
  });

  // Message listener for keyboard shortcuts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeSort') {
      executeSortOnAllWindows();
    }
  });
}

function switchView(view) {
  currentView = view;
  
  // Update navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  
  // Update content
  document.querySelectorAll('.content-area').forEach(area => {
    area.classList.add('hidden');
  });
  
  const viewElement = document.getElementById(`${view}View`);
  if (viewElement) {
    viewElement.classList.remove('hidden');
  }
  
  if (view === 'active') {
    loadActiveWindows();
  } else if (view === 'saved') {
    loadSavedWindows();
  }
}

async function loadActiveWindows() {
  chrome.runtime.sendMessage({ action: 'getAllWindows' }, (windows) => {
    currentWindows = windows || [];
    renderActiveWindows();
    updateWindowCount();
  });
}

async function loadSavedWindows() {
  chrome.runtime.sendMessage({ action: 'getSavedWindows' }, (windows) => {
    savedWindows = windows || [];
    renderSavedWindows();
  });
}

function renderActiveWindows() {
  const container = document.getElementById('windowsList');
  
  if (currentWindows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No windows open</h3>
        <p>Your active windows will appear here</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  currentWindows.forEach((window, index) => {
    const windowCard = createWindowCard(window, index, false);
    container.appendChild(windowCard);
  });
}

function renderSavedWindows() {
  const container = document.getElementById('savedWindowsList');
  
  if (savedWindows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No saved windows</h3>
        <p>Save windows to restore them later</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  savedWindows.forEach((window) => {
    const windowCard = createWindowCard(window, null, true);
    container.appendChild(windowCard);
  });
}

function createWindowCard(window, index, isSaved) {
  const card = document.createElement('div');
  card.className = 'window-card';
  
  const header = document.createElement('div');
  header.className = 'window-header';
  header.onclick = () => toggleWindowExpand(card);
  
  const icon = document.createElement('div');
  icon.className = 'window-icon';
  icon.innerHTML = isSaved ? '📁' : (window.focused ? '🟢' : '⚪');
  
  const title = document.createElement('div');
  title.className = 'window-title';
  title.textContent = isSaved ? window.name : `${window.focused ? 'Current Window' : `Window ${index + 1}`}`;
  
  const meta = document.createElement('div');
  meta.className = 'window-meta';
  
  const tabCount = document.createElement('span');
  tabCount.className = 'tab-count';
  tabCount.textContent = `${window.tabs.length}`;
  
  const tabLabel = document.createElement('span');
  tabLabel.textContent = 'tabs';
  
  const actions = document.createElement('div');
  actions.className = 'window-actions';
  
  if (isSaved) {
    const restoreBtn = createActionButton('Restore', 'primary', () => {
      chrome.runtime.sendMessage({ action: 'restoreWindow', windowId: window.id });
    });
    
    const deleteBtn = createActionButton('Delete', 'danger', () => {
      chrome.runtime.sendMessage({ action: 'deleteWindow', windowId: window.id });
      loadSavedWindows();
    });
    
    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);
  } else {
    const saveBtn = createActionButton('Save', 'primary', () => {
      saveWindow(window);
    });
    
    if (currentWindows.length > 1 && !window.focused) {
      const focusBtn = createActionButton('Focus', '', () => {
        chrome.windows.update(window.id, { focused: true });
        loadActiveWindows();
      });
      
      const closeBtn = createActionButton('Close', 'danger', () => {
        chrome.windows.remove(window.id);
        loadActiveWindows();
      });
      
      actions.appendChild(focusBtn);
      actions.appendChild(closeBtn);
    }
    
    actions.appendChild(saveBtn);
  }
  
  meta.appendChild(tabCount);
  meta.appendChild(tabLabel);
  meta.appendChild(actions);
  
  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(meta);
  
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'tabs-container';
  
  const tabsToRender = sortTabs(window.tabs);
  
  tabsToRender.forEach(tab => {
    const tabItem = createTabItem(tab, window.id, isSaved);
    tabsContainer.appendChild(tabItem);
  });
  
  card.appendChild(header);
  card.appendChild(tabsContainer);
  
  return card;
}

function createTabItem(tab, windowId, isSaved) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.dataset.tabId = tab.id;
  checkbox.dataset.windowId = windowId;
  
  if (tab.favIconUrl) {
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => { favicon.style.display = 'none'; };
    item.appendChild(favicon);
  }
  
  const info = document.createElement('div');
  info.className = 'tab-info';
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';
  
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;
  
  info.appendChild(title);
  info.appendChild(url);
  
  const indicators = document.createElement('div');
  indicators.className = 'tab-indicators';
  
  if (!isSaved) {
    item.appendChild(checkbox);
    
    if (tab.pinned) {
      const pinned = document.createElement('div');
      pinned.className = 'indicator pinned';
      indicators.appendChild(pinned);
    }
    
    if (tab.audible) {
      const audio = document.createElement('div');
      audio.className = tab.mutedInfo?.muted ? 'indicator muted' : 'indicator audio';
      indicators.appendChild(audio);
    }
  }
  
  const actions = document.createElement('div');
  actions.className = 'tab-actions';
  
  if (!isSaved) {
    const focusBtn = document.createElement('button');
    focusBtn.className = 'tab-action';
    focusBtn.textContent = 'Focus';
    focusBtn.onclick = (e) => {
      e.stopPropagation();
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(windowId, { focused: true });
    };
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-action close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tab.id);
      loadActiveWindows();
    };
    
    actions.appendChild(focusBtn);
    actions.appendChild(closeBtn);
  }
  
  item.appendChild(info);
  item.appendChild(indicators);
  item.appendChild(actions);
  
  if (!isSaved) {
    item.onclick = (event) => {
      if (!event.target.matches('button, input')) {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(windowId, { focused: true });
      }
    };
  }
  
  return item;
}

function createActionButton(text, className, onClick) {
  const btn = document.createElement('button');
  btn.className = `action-btn ${className}`;
  btn.textContent = text;
  btn.onclick = (e) => {
    e.stopPropagation();
    onClick();
  };
  return btn;
}

function toggleWindowExpand(card) {
  const container = card.querySelector('.tabs-container');
  container.classList.toggle('expanded');
}

function updateWindowCount() {
  const count = currentWindows.length;
  document.getElementById('windowCount').textContent = `${count} window${count !== 1 ? 's' : ''}`;
}

function refresh() {
  if (currentView === 'active') {
    loadActiveWindows();
  } else if (currentView === 'saved') {
    loadSavedWindows();
  }
}

async function mergeAllWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  if (windows.length <= 1) return;
  
  const currentWindow = await chrome.windows.getCurrent();
  const tabIds = [];
  
  windows.forEach(window => {
    if (window.id !== currentWindow.id) {
      window.tabs.forEach(tab => {
        tabIds.push(tab.id);
      });
    }
  });
  
  if (tabIds.length > 0) {
    chrome.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 });
    setTimeout(() => loadActiveWindows(), 500);
  }
}

async function saveAllWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  
  windows.forEach((window, index) => {
    const savedWindow = {
      id: Date.now() + index,
      name: `All Windows - ${new Date().toLocaleString()}`,
      tabs: window.tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned
      }))
    };
    
    savedWindows.push(savedWindow);
  });
  
  chrome.storage.local.set({ savedWindows });
  
  if (currentView === 'saved') {
    renderSavedWindows();
  }
}

function saveWindow(window) {
  const savedWindow = {
    id: Date.now(),
    name: `Window - ${new Date().toLocaleString()}`,
    tabs: window.tabs
  };
  
  savedWindows.push(savedWindow);
  chrome.storage.local.set({ savedWindows });
  
  if (currentView === 'saved') {
    renderSavedWindows();
  }
}

function searchTabs(query) {
  if (!query) {
    if (currentView === 'active') {
      renderActiveWindows();
    }
    return;
  }
  
  const filteredWindows = currentWindows.map(window => {
    const filteredTabs = window.tabs.filter(tab => 
      tab.title.toLowerCase().includes(query.toLowerCase()) ||
      tab.url.toLowerCase().includes(query.toLowerCase())
    );
    
    return {
      ...window,
      tabs: sortTabs(filteredTabs)
    };
  }).filter(window => window.tabs.length > 0);
  
  const container = document.getElementById('windowsList');
  
  if (filteredWindows.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No matching tabs</h3>
        <p>Try a different search term</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  filteredWindows.forEach((window, index) => {
    const windowCard = createWindowCard(window, index, false);
    container.appendChild(windowCard);
  });
}

function setViewMode(mode) {
  document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
  document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
  
  const container = document.getElementById('windowsList');
  if (mode === 'grid') {
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    container.style.gap = '15px';
  } else {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';
  }
}

function sortTabs(tabs) {
  return tabs.slice().sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'url':
        aValue = a.url.toLowerCase();
        bValue = b.url.toLowerCase();
        break;
      case 'domain':
        aValue = new URL(a.url).hostname.toLowerCase();
        bValue = new URL(b.url).hostname.toLowerCase();
        break;
      default:
        return 0;
    }
    
    return aValue.localeCompare(bValue);
  });
}

function applySorting() {
  if (currentView === 'active') {
    renderActiveWindows();
  } else if (currentView === 'saved') {
    renderSavedWindows();
  }
}

async function executeSortOnAllWindows() {
  chrome.runtime.sendMessage({ 
    action: 'sortAllWindows', 
    sortBy: sortBy
  }, () => {
    // Refresh the display after sorting
    setTimeout(() => {
      loadActiveWindows();
    }, 500);
  });
}

