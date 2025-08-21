# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyWM is a Chrome extension (Manifest V3) for window and tab management. The extension provides:
- Real-time window and tab organization with auto-refresh
- Tab sorting capabilities (by domain)
- Single manager page interface (accessed via toolbar icon or Cmd+M)
- Keyboard shortcuts for common operations

## Architecture

### Core Components

1. **Background Service Worker** (`background.js`)
   - Central message handler for all extension operations
   - Auto-refresh functionality using Chrome API event listeners
   - Handles keyboard shortcuts (sort-tabs, open-manager)
   - Coordinates tab/window manipulation operations
   - Tab sorting by domain with notifications

2. **Manager Page** (`manager.js`, `manager.html`, `manager.css`)
   - Single full-page interface (no popup)
   - Real-time window and tab display with auto-refresh
   - Batch operations: merge all windows, sort all windows
   - Grid/list view toggles
   - Accessed via browser action click or Cmd+M shortcut

### Message Flow

All operations flow through the background script via Chrome's message passing:
- Manager page sends messages with `chrome.runtime.sendMessage`
- Background script processes requests and returns responses
- Auto-refresh events sent from background to manager via `autoRefresh` messages
- Actions include: `getAllWindows`, `sortTabsInWindow`, `sortAllWindows`, `mergeAllWindows`

### Auto-Refresh System

The extension automatically refreshes the manager interface when:
- Tabs are created, removed, or updated (URL/title/status changes)
- Windows are created or removed
- Background script sends `autoRefresh` messages to manager page
- No manual refresh needed - real-time updates via Chrome API event listeners

## Development Commands

Since this is a vanilla JavaScript Chrome extension without a build system:

```bash
# Load extension in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select this directory

# To test changes:
# 1. Make code changes
# 2. Click "Reload" button in chrome://extensions/ for the extension
# 3. Test functionality in browser

# Check for errors:
# View background script logs in chrome://extensions/ → "Inspect views: service worker"
# View popup/manager logs via right-click → Inspect on the respective pages
```

## TypeScript Diagnostics

The codebase has TypeScript checking enabled (likely via VS Code), with current warnings about unused parameters:
- `background.js:69` - unused 'sender' parameter
- `manager.js:62` - unused 'sender' and 'sendResponse' parameters

These are callback parameters from Chrome APIs that may be needed for future functionality.

## Key Files to Edit

- **Adding new features**: Start with message handler in `background.js` then add UI in manager page
- **Keyboard shortcuts**: Define in `manifest.json` commands section, handle in `background.js`
- **UI changes**: Modify manager.html, manager.css, or manager.js
- **Auto-refresh events**: Add new event listeners in `background.js` and handle in `notifyUIRefresh()`
- **Permissions**: Update in `manifest.json` if new Chrome APIs needed

## Chrome Extension APIs Used

- `chrome.windows.*` - Window management
- `chrome.tabs.*` - Tab operations
- `chrome.storage.local` - Data persistence
- `chrome.commands` - Keyboard shortcuts
- `chrome.notifications` - User notifications
- `chrome.runtime` - Message passing
- `chrome.action` - Browser action (toolbar icon)
