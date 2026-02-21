# AI Contribution Tracker (LLM-Tracker)

A privacy-first Chrome extension that tracks and visualizes your AI platform usage with a beautiful GitHub-style contribution graph.

![Extension Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest Version](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## Features

- **GitHub-Style Heatmap**: Visualize your AI usage over the last 365 days
- **Privacy-First**: All data stored locally - zero data exfiltration
- **Multi-Platform Support**: Tracks ChatGPT, Claude, Gemini, and DeepSeek
- **Statistics Dashboard**: View daily counts, streaks, and platform breakdowns
- **Data Management**: Export and import your data as JSON
- **Beautiful UI**: Dark theme inspired by GitHub's contribution graph

## Installation

There are two ways to install the extension from GitHub:

### Option 1: Download ZIP (Easiest for most users)

1. Go to the [GitHub repository page](https://github.com/Jolvin-James/AI-Contibution-Tracker).
2. Click the green **Code** button and select **Download ZIP**.
3. Extract the downloaded ZIP file to a folder on your computer.
4. **Open your browser's Extensions page**:
   - Chrome/Brave: Navigate to `chrome://extensions/`
   - Edge: Navigate to `edge://extensions/`
5. Turn on **Developer mode** (usually a toggle in the top-right corner or left sidebar).
6. Click **Load unpacked** and select the extracted folder (make sure to select the folder containing the `manifest.json` file).
7. The extension icon should now appear in your toolbar!

### Option 2: Clone with Git (For developers)

1. **Clone this repository**
   ```bash
   git clone https://github.com/Jolvin-James/AI-Contibution-Tracker.git
   cd AI-Contribution-Tracker
   ```

2. **Open your browser's Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right corner)

3. **Load the extension**
   - Click **Load unpacked**
   - Select the `AI-Contribution-Tracker` directory

4. **Verify installation**
   - The extension icon should appear in your toolbar
   - Visit any supported AI platform and send a message to test

## Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| **ChatGPT** | chatgpt.com | Supported |
| **Claude** | claude.ai | Supported |
| **Gemini** | gemini.google.com | Supported |
| **DeepSeek** | chat.deepseek.com | Supported |

## How It Works

### Data Collection

The extension uses **content scripts** that inject `MutationObserver` instances into each AI platform's DOM. These observers detect when you send a message by watching for new user message elements in the chat interface.

**Privacy Guarantee**: The extension only detects the *presence* of messages, never their content. Your prompts and conversations remain completely private.

### Data Storage

All data is stored in `chrome.storage.local` using this schema:

```json
{
  "usage_stats": {
    "2026-02-04": {
      "chatgpt": 12,
      "claude": 5,
      "gemini": 0,
      "deepseek": 2,
      "total": 19
    }
  },
  "current_streak": 4,
  "longest_streak": 12
}
```

### Streak Calculation

- **Current Streak**: Consecutive days with at least one contribution, including today or yesterday
- **Longest Streak**: The longest consecutive streak in your history

## Usage

1. **View Dashboard**: Click the extension icon to open the popup
2. **Check Stats**: View today's count, current streak, and total contributions
3. **Explore Heatmap**: Hover over squares to see contribution counts for specific dates
4. **Platform Breakdown**: See which AI platforms you use most
5. **Export Data**: Click "Export Data" to download your statistics as JSON
6. **Import Data**: Click "Import Data" to restore from a backup

## Project Structure

```
AI-Contribution-Tracker/
├── manifest.json              # Extension configuration
├── package.json              # Project metadata
├── README.md                 # This file
├── PRD.md                    # Product requirements document
├── src/
│   ├── background/
│   │   └── service-worker.js # Background service worker
│   ├── content/
│   │   ├── tracker-chatgpt.js   # ChatGPT tracker
│   │   ├── tracker-claude.js    # Claude tracker
│   │   ├── tracker-gemini.js    # Gemini tracker
│   │   └── tracker-deepseek.js  # DeepSeek tracker
│   ├── popup/
│   │   ├── popup.html        # Dashboard UI
│   │   ├── popup.css         # Styles
│   │   └── popup.js          # Dashboard logic
│   ├── utils/
│   │   └── storage.js        # Storage utilities
│   └── assets/
│       ├── icon16.png        # Extension icons
│       ├── icon48.png
│       └── icon128.png
```

## Technical Details

### Manifest V3

This extension uses Chrome's Manifest V3, which provides:
- Enhanced security
- Better performance
- Service worker-based background scripts

### Permissions

The extension requires minimal permissions:
- `storage`: For local data persistence
- `host_permissions`: Limited to specific AI platform domains only

### Performance Optimizations

- **Debouncing**: Prevents duplicate message counts (1-second debounce)
- **Visibility API**: Disconnects observers when tabs are hidden
- **Memory Management**: Limits stored message IDs to prevent memory leaks

## Color Scheme

The heatmap uses GitHub's contribution graph colors:

| Level | Count Range | Color |
|-------|-------------|-------|
| 0 | 0 | `#161b22` |
| 1 | 1-4 | `#0e4429` |
| 2 | 5-9 | `#006d32` |
| 3 | 10-19 | `#26a641` |
| 4 | 20+ | `#39d353` |

## Known Limitations

### DOM Dependency

AI platforms frequently update their UI, which may break the trackers. The extension uses robust selectors with multiple fallbacks, but updates may still cause issues.

**If tracking stops working:**
1. Check the browser console for errors
2. Report the issue with the platform name and date
3. The selectors may need updating

### False Positives

The extension attempts to prevent false positives by:
- Only counting when user message bubbles appear in the DOM
- Using debouncing to prevent duplicate counts
- Tracking unique message identifiers

## Privacy & Security

- **No remote servers**: All data stays on your device
- **No analytics**: Zero tracking or telemetry
- **Content agnostic**: Never reads prompt text
- **Minimal permissions**: Only what's absolutely necessary
- **Open source**: Code is fully auditable

## Contributing

Contributions are welcome! Areas for improvement:

- Additional AI platform support
- Improved DOM selectors for existing platforms
- Settings page with customization options
- Daily goal tracking
- Weekly/monthly statistics views

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Inspired by GitHub's contribution graph
- Built with Manifest V3 best practices
- Designed for privacy-conscious users

---

**Made for AI enthusiasts who want to track their productivity**
