let currentWindows = [];

document.addEventListener('DOMContentLoaded', () => {
  loadActiveWindows();
  setupEventListeners();
  updateWindowCount();
});

function setupEventListeners() {

  // Toolbar buttons (refresh button removed - auto-refresh is now enabled)
  document.getElementById('mergeAllBtn').addEventListener('click', mergeAllWindows);
  
  // Sort button
  document.getElementById('executeSortBtn').addEventListener('click', () => {
    executeSortOnAllWindows();
  });
  
  // Remove duplicates button
  document.getElementById('removeDuplicatesBtn').addEventListener('click', () => {
    removeAllDuplicates();
  });


  // Message listener for keyboard shortcuts and auto-refresh
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeSort') {
      executeSortOnAllWindows();
    } else if (message.action === 'autoRefresh') {
      refresh();
    }
  });
}


async function loadActiveWindows() {
  chrome.runtime.sendMessage({ action: 'getAllWindows' }, (windows) => {
    currentWindows = windows || [];
    renderActiveWindows();
    updateWindowCount();
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
    const windowCard = createWindowCard(window, index);
    container.appendChild(windowCard);
  });
}

function createWindowCard(window, index) {
  const card = document.createElement('div');
  card.className = 'window-card';
  
  const header = document.createElement('div');
  header.className = 'window-header';
  
  const title = document.createElement('div');
  title.className = 'window-title';
  title.textContent = `Window ${index + 1}`;
  
  const meta = document.createElement('div');
  meta.className = 'window-meta';
  
  const tabCount = document.createElement('span');
  tabCount.className = 'tab-count';
  tabCount.textContent = `${window.tabs.length}`;
  
  const tabLabel = document.createElement('span');
  tabLabel.textContent = 'tabs';
  
  const actions = document.createElement('div');
  actions.className = 'window-actions';
  
  // Show close button for all windows (including active/focused windows)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'action-btn close-icon';
  closeBtn.innerHTML = '×';
  closeBtn.title = 'Close window';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    chrome.windows.remove(window.id);
    loadActiveWindows();
  };
  
  actions.appendChild(closeBtn);
  
  meta.appendChild(tabCount);
  meta.appendChild(tabLabel);
  meta.appendChild(actions);
  
  header.appendChild(title);
  header.appendChild(meta);
  
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'tabs-container';
  
  // Group tabs by domain
  const domainGroups = groupTabsByDomain(window.tabs);
  
  // Render each domain group
  domainGroups.forEach(group => {
    const groupEl = createDomainGroupElement(group, window.id);
    tabsContainer.appendChild(groupEl);
  });
  
  card.appendChild(header);
  card.appendChild(tabsContainer);
  
  return card;
}

function createTabItem(tab, windowId) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.dataset.tabId = tab.id;
  checkbox.dataset.windowId = windowId;
  
  const favicon = document.createElement('div');
  favicon.className = 'tab-favicon';
  
  if (tab.favIconUrl) {
    const img = document.createElement('img');
    img.src = tab.favIconUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.onerror = () => {
      img.remove();
      favicon.innerHTML = '🌐';
      favicon.style.display = 'flex';
      favicon.style.alignItems = 'center';
      favicon.style.justifyContent = 'center';
      favicon.style.fontSize = '12px';
    };
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = '🌐';
    favicon.style.display = 'flex';
    favicon.style.alignItems = 'center';
    favicon.style.justifyContent = 'center';
    favicon.style.fontSize = '12px';
  }
  
  item.appendChild(favicon);
  
  const info = document.createElement('div');
  info.className = 'tab-info';
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'Untitled';
  
  info.appendChild(title);
  
  const indicators = document.createElement('div');
  indicators.className = 'tab-indicators';
  
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
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close tab';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ 
      action: 'closeTab', 
      tabId: tab.id 
    });
  };
  indicators.appendChild(closeBtn);
  
  item.appendChild(info);
  item.appendChild(indicators);
  
  item.onclick = (event) => {
    if (!event.target.matches('button, input')) {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(windowId, { focused: true });
    }
  };
  
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


function updateWindowCount() {
  const count = currentWindows.length;
  document.getElementById('windowCount').textContent = `${count} window${count !== 1 ? 's' : ''}`;
}

function refresh() {
  loadActiveWindows();
}

async function mergeAllWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  // Filter out Picture-in-Picture windows
  const filteredWindows = windows.filter(window => !window.alwaysOnTop);
  if (filteredWindows.length <= 1) return;
  
  const currentWindow = await chrome.windows.getCurrent();
  const tabIds = [];
  
  filteredWindows.forEach(window => {
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



function sortTabs(tabs) {
  // Always sort by domain
  return tabs.slice().sort((a, b) => {
    const aValue = new URL(a.url).hostname.toLowerCase();
    const bValue = new URL(b.url).hostname.toLowerCase();
    return aValue.localeCompare(bValue);
  });
}


async function executeSortOnAllWindows() {
  chrome.runtime.sendMessage({ 
    action: 'sortAllWindows'
  }, () => {
    // Refresh the display after sorting
    setTimeout(() => {
      loadActiveWindows();
    }, 500);
  });
}

function groupTabsByDomain(tabs) {
  const domainMap = new Map();
  const otherTabs = [];
  
  tabs.forEach(tab => {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname || 'other';
      
      if (!domainMap.has(domain)) {
        domainMap.set(domain, []);
      }
      domainMap.get(domain).push(tab);
    } catch (e) {
      // Invalid URL, add to other
      otherTabs.push(tab);
    }
  });
  
  const groups = [];
  
  // Process domains with multiple tabs
  domainMap.forEach((tabList, domain) => {
    if (tabList.length >= 2) {
      // Sort tabs within group by URL
      tabList.sort((a, b) => a.url.toLowerCase().localeCompare(b.url.toLowerCase()));
      groups.push({
        domain: domain,
        tabs: tabList,
        isGroup: true
      });
    } else {
      // Single tab domains go to other
      otherTabs.push(...tabList);
    }
  });
  
  // Sort groups by domain name
  groups.sort((a, b) => a.domain.localeCompare(b.domain));
  
  // Add other group if there are any other tabs
  if (otherTabs.length > 0) {
    // Sort other tabs by URL
    otherTabs.sort((a, b) => a.url.toLowerCase().localeCompare(b.url.toLowerCase()));
    groups.push({
      domain: 'other',
      tabs: otherTabs,
      isGroup: true
    });
  }
  
  return groups;
}

function createDomainGroupElement(group, windowId) {
  const groupEl = document.createElement('div');
  groupEl.className = 'domain-group';
  
  // Create group header
  const headerEl = document.createElement('div');
  headerEl.className = 'domain-group-header';
  headerEl.onclick = (e) => {
    if (!e.target.classList.contains('domain-close-all')) {
      toggleDomainGroupExpand(groupEl);
    }
  };
  
  // Domain icon and name
  const domainInfoEl = document.createElement('div');
  domainInfoEl.className = 'domain-info';
  
  // Get favicon from first tab
  if (group.tabs[0].favIconUrl && group.domain !== 'other') {
    const favicon = document.createElement('img');
    favicon.className = 'domain-favicon';
    favicon.src = group.tabs[0].favIconUrl;
    favicon.onerror = () => { favicon.style.display = 'none'; };
    domainInfoEl.appendChild(favicon);
  } else {
    const icon = document.createElement('div');
    icon.className = 'domain-icon-placeholder';
    icon.textContent = group.domain === 'other' ? '📂' : '🌐';
    domainInfoEl.appendChild(icon);
  }
  
  const domainNameEl = document.createElement('span');
  domainNameEl.className = 'domain-name';
  domainNameEl.textContent = group.domain;
  domainInfoEl.appendChild(domainNameEl);
  
  // Tab count
  const tabCountEl = document.createElement('span');
  tabCountEl.className = 'domain-tab-count';
  tabCountEl.textContent = `(${group.tabs.length})`;
  
  // Actions container
  const actionsEl = document.createElement('div');
  actionsEl.className = 'domain-actions';
  
  // Close all tabs button
  const closeAllBtn = document.createElement('button');
  closeAllBtn.className = 'domain-close-all';
  closeAllBtn.textContent = '✕';
  closeAllBtn.title = 'Close all tabs in this group';
  closeAllBtn.onclick = (e) => {
    e.stopPropagation();
    const tabIds = group.tabs.map(tab => tab.id);
    chrome.tabs.remove(tabIds);
    setTimeout(() => loadActiveWindows(), 100);
  };
  actionsEl.appendChild(closeAllBtn);
  
  // Expand/collapse indicator
  const expandEl = document.createElement('span');
  expandEl.className = 'expand-indicator';
  expandEl.textContent = '▼';
  
  headerEl.appendChild(domainInfoEl);
  headerEl.appendChild(tabCountEl);
  headerEl.appendChild(actionsEl);
  headerEl.appendChild(expandEl);
  
  // Create tabs container
  const tabsListEl = document.createElement('div');
  tabsListEl.className = 'domain-tabs-list';
  
  // Tabs are already sorted by URL within groups
  group.tabs.forEach(tab => {
    const tabEl = createTabItem(tab, windowId);
    tabsListEl.appendChild(tabEl);
  });
  
  groupEl.appendChild(headerEl);
  groupEl.appendChild(tabsListEl);
  
  return groupEl;
}

function toggleDomainGroupExpand(groupEl) {
  const tabsList = groupEl.querySelector('.domain-tabs-list');
  const indicator = groupEl.querySelector('.expand-indicator');
  
  if (tabsList.classList.contains('collapsed')) {
    tabsList.classList.remove('collapsed');
    indicator.textContent = '▼';
  } else {
    tabsList.classList.add('collapsed');
    indicator.textContent = '▶';
  }
}

async function removeAllDuplicates() {
  chrome.runtime.sendMessage({ 
    action: 'removeDuplicates'
  }, (result) => {
    if (result && result.removedCount > 0) {
      // Refresh the display after removing duplicates
      setTimeout(() => {
        loadActiveWindows();
      }, 500);
    }
  });
}

