let currentWindows = [];
let searchTimeout;

document.addEventListener('DOMContentLoaded', () => {
  loadCurrentWindows();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('mergeWindows').addEventListener('click', mergeAllWindows);
  
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTabs(e.target.value);
    }, 300);
  });
  
  document.getElementById('openManager').addEventListener('click', () => {
    chrome.tabs.create({ url: 'manager.html' });
    window.close();
  });

}

async function loadCurrentWindows() {
  chrome.runtime.sendMessage({ action: 'getAllWindows' }, (windows) => {
    currentWindows = windows;
    renderCurrentWindows();
  });
}


function renderCurrentWindows() {
  const container = document.getElementById('currentWindows');
  
  if (currentWindows.length === 0) {
    container.innerHTML = '<div class="empty-state">No windows open</div>';
    return;
  }
  
  container.innerHTML = '';
  
  currentWindows.forEach((window, index) => {
    const windowEl = createWindowElement(window, index);
    container.appendChild(windowEl);
  });
}

function createWindowElement(window, index) {
  const windowEl = document.createElement('div');
  windowEl.className = 'window-item';
  if (window.focused) windowEl.classList.add('focused');
  
  const headerEl = document.createElement('div');
  headerEl.className = 'window-header';
  headerEl.onclick = () => toggleWindowExpand(windowEl);
  
  const titleEl = document.createElement('div');
  titleEl.className = 'window-title';
  titleEl.textContent = `Window ${index + 1}`;
  
  const infoEl = document.createElement('div');
  infoEl.className = 'window-info';
  
  const tabCountEl = document.createElement('span');
  tabCountEl.className = 'tab-count';
  tabCountEl.textContent = `${window.tabs.length} tabs`;
  
  const actionsEl = document.createElement('div');
  actionsEl.className = 'window-actions';
  
  if (currentWindows.length > 1) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'window-action danger';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      chrome.windows.remove(window.id);
      loadCurrentWindows();
    };
    actionsEl.appendChild(closeBtn);
  }
  
  infoEl.appendChild(tabCountEl);
  infoEl.appendChild(actionsEl);
  
  headerEl.appendChild(titleEl);
  headerEl.appendChild(infoEl);
  
  const tabsListEl = document.createElement('div');
  tabsListEl.className = 'tabs-list';
  
  // Group tabs by domain
  const domainGroups = groupTabsByDomain(window.tabs);
  
  // Render each domain group
  domainGroups.forEach(group => {
    const groupEl = createDomainGroupElement(group, window.id);
    tabsListEl.appendChild(groupEl);
  });
  
  windowEl.appendChild(headerEl);
  windowEl.appendChild(tabsListEl);
  
  return windowEl;
}

function createTabElement(tab, windowId) {
  const tabEl = document.createElement('div');
  tabEl.className = 'tab-item';
  
  if (tab.favIconUrl) {
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl;
    favicon.onerror = () => { favicon.style.display = 'none'; };
    tabEl.appendChild(favicon);
  }
  
  const titleEl = document.createElement('div');
  titleEl.className = 'tab-title';
  titleEl.textContent = tab.title || tab.url;
  titleEl.title = tab.title || tab.url;
  
  const actionsEl = document.createElement('div');
  actionsEl.className = 'tab-actions';
  
  if (tab.pinned) {
    const pinnedIcon = document.createElement('div');
    pinnedIcon.className = 'pinned-indicator';
    actionsEl.appendChild(pinnedIcon);
  }
  
  if (tab.audible) {
    const audioIcon = document.createElement('div');
    audioIcon.className = tab.mutedInfo?.muted ? 'muted-indicator' : 'audio-indicator';
    actionsEl.appendChild(audioIcon);
  }
  
  const focusBtn = document.createElement('button');
  focusBtn.className = 'tab-action';
  focusBtn.textContent = 'Go';
  focusBtn.onclick = (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ 
      action: 'focusTab', 
      tabId: tab.id,
      windowId: windowId
    });
    window.close();
  };
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-action close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'closeTab', tabId: tab.id });
    loadCurrentWindows();
  };
  
  actionsEl.appendChild(focusBtn);
  actionsEl.appendChild(closeBtn);
  
  tabEl.appendChild(titleEl);
  tabEl.appendChild(actionsEl);
  
  tabEl.onclick = () => {
    chrome.runtime.sendMessage({ 
      action: 'focusTab', 
      tabId: tab.id,
      windowId: windowId
    });
    window.close();
  };
  
  return tabEl;
}

function toggleWindowExpand(windowEl) {
  const tabsList = windowEl.querySelector('.tabs-list');
  tabsList.classList.toggle('expanded');
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
    setTimeout(() => loadCurrentWindows(), 500);
  }
}

function searchTabs(query) {
  const resultsEl = document.getElementById('searchResults');
  
  if (!query) {
    resultsEl.classList.add('hidden');
    return;
  }
  
  chrome.runtime.sendMessage({ action: 'searchTabs', query }, (tabs) => {
    if (tabs.length === 0) {
      resultsEl.innerHTML = '<div class="empty-state">No matching tabs found</div>';
    } else {
      resultsEl.innerHTML = '';
      const sortedTabs = sortTabs(tabs);
      sortedTabs.forEach(tab => {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item';
        
        if (tab.favIconUrl) {
          const favicon = document.createElement('img');
          favicon.className = 'tab-favicon';
          favicon.src = tab.favIconUrl;
          favicon.onerror = () => { favicon.style.display = 'none'; };
          resultEl.appendChild(favicon);
        }
        
        const titleEl = document.createElement('div');
        titleEl.className = 'tab-title';
        titleEl.textContent = tab.title;
        titleEl.title = tab.url;
        
        resultEl.appendChild(titleEl);
        resultEl.onclick = () => {
          chrome.runtime.sendMessage({ 
            action: 'focusTab', 
            tabId: tab.id,
            windowId: tab.windowId
          });
          window.close();
        };
        
        resultsEl.appendChild(resultEl);
      });
    }
    
    resultsEl.classList.remove('hidden');
  });
}

function sortTabs(tabs) {
  // Always sort by domain
  return tabs.slice().sort((a, b) => {
    const aValue = new URL(a.url).hostname.toLowerCase();
    const bValue = new URL(b.url).hostname.toLowerCase();
    return aValue.localeCompare(bValue);
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
  headerEl.onclick = () => toggleDomainGroupExpand(groupEl);
  
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
  }
  
  const domainNameEl = document.createElement('span');
  domainNameEl.className = 'domain-name';
  domainNameEl.textContent = group.domain;
  domainInfoEl.appendChild(domainNameEl);
  
  // Tab count
  const tabCountEl = document.createElement('span');
  tabCountEl.className = 'domain-tab-count';
  tabCountEl.textContent = `(${group.tabs.length})`;
  
  // Expand/collapse indicator
  const expandEl = document.createElement('span');
  expandEl.className = 'expand-indicator';
  expandEl.textContent = '▼';
  
  headerEl.appendChild(domainInfoEl);
  headerEl.appendChild(tabCountEl);
  headerEl.appendChild(expandEl);
  
  // Create tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'domain-tabs-list';
  
  // Tabs are already sorted by URL within groups
  group.tabs.forEach(tab => {
    const tabEl = createTabElement(tab, windowId);
    tabsContainer.appendChild(tabEl);
  });
  
  groupEl.appendChild(headerEl);
  groupEl.appendChild(tabsContainer);
  
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