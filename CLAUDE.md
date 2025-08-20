# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyWM is a Chrome extension (Manifest V3) for window and tab management. The extension provides:
- Window and tab organization with save/restore functionality
- Tab search and sorting capabilities
- Multiple UI views (popup and full manager page)
- Keyboard shortcuts for common operations

## Architecture

### Core Components

1. **Background Service Worker** (`background.js`)
   - Central message handler for all extension operations
   - Manages saved windows state via Chrome Storage API
   - Handles keyboard shortcuts (save-window, search-tabs, sort-tabs)
   - Coordinates tab/window manipulation operations

2. **Popup Interface** (`popup.js`, `popup.html`, `popup.css`)
   - Quick access interface from browser toolbar
   - Two tabs: Current Windows and Saved Windows
   - Search functionality with real-time filtering
   - Window save/restore and tab management

3. **Manager Page** (`manager.js`, `manager.html`, `manager.css`)
   - Full-page management interface
   - Advanced features: batch operations, detailed views
   - Settings management (dark mode)
   - Grid/list view toggles

### Message Flow

All operations flow through the background script via Chrome's message passing:
- UI components send messages with `chrome.runtime.sendMessage`
- Background script processes requests and returns responses
- Actions include: `getAllWindows`, `searchTabs`, `saveWindow`, `restoreWindow`, `sortTabsInWindow`, etc.

### Data Persistence

- Saved windows stored in `chrome.storage.local`
- Settings (dark mode, view preferences) also use Chrome Storage API
- Window data structure includes tabs with url, title, favIconUrl, and pinned status

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

- **Adding new features**: Start with message handler in `background.js` then add UI in popup/manager
- **Keyboard shortcuts**: Define in `manifest.json` commands section, handle in `background.js`
- **UI changes**: Modify corresponding HTML/CSS/JS files (popup.* or manager.*)
- **Permissions**: Update in `manifest.json` if new Chrome APIs needed

## Chrome Extension APIs Used

- `chrome.windows.*` - Window management
- `chrome.tabs.*` - Tab operations
- `chrome.storage.local` - Data persistence
- `chrome.commands` - Keyboard shortcuts
- `chrome.notifications` - User notifications
- `chrome.runtime` - Message passing
- `chrome.action` - Browser action (toolbar icon)