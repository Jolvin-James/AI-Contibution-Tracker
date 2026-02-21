// Background Service Worker for AI Contribution Tracker
// Handles messages from content scripts and updates badge

// Supported platforms
const SUPPORTED_PLATFORMS = ['chatgpt', 'claude', 'gemini', 'deepseek'];

// Import storage utilities (inline since service workers have import limitations)
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function incrementCount(platform) {
    // Validate platform
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
        console.error(`[AI Tracker] Invalid platform: ${platform}`);
        throw new Error(`Invalid platform: ${platform}`);
    }

    const today = getTodayDate();

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['usage_stats'], (result) => {
            // Check for errors
            if (chrome.runtime.lastError) {
                console.error('[AI Tracker] Storage get error:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }

            const stats = result.usage_stats || {};

            if (!stats[today]) {
                stats[today] = {
                    chatgpt: 0,
                    claude: 0,
                    gemini: 0,
                    deepseek: 0,
                    total: 0
                };
            }

            stats[today][platform] = (stats[today][platform] || 0) + 1;
            stats[today].total =
                stats[today].chatgpt +
                stats[today].claude +
                stats[today].gemini +
                stats[today].deepseek;

            chrome.storage.local.set({ usage_stats: stats }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[AI Tracker] Storage set error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(stats[today].total);
            });
        });
    });
}

async function calculateStreaks() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['usage_stats'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('[AI Tracker] Storage get error:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
                return;
            }

            const usage_stats = result.usage_stats || {};

            // Filter to only dates with actual activity (total > 0), sorted ascending
            const activeDates = Object.keys(usage_stats)
                .filter(date => usage_stats[date].total > 0)
                .sort();

            if (activeDates.length === 0) {
                chrome.storage.local.set({ current_streak: 0, longest_streak: 0 }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[AI Tracker] Storage set error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                        return;
                    }
                    resolve({ current_streak: 0, longest_streak: 0 });
                });
                return;
            }

            // Helper: get the difference in days between two YYYY-MM-DD strings
            function daysBetween(dateStrA, dateStrB) {
                const a = new Date(dateStrA).getTime();
                const b = new Date(dateStrB).getTime();
                return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
            }

            const today = getTodayDate();

            // --- Current streak ---
            // Walk backwards from today. The most recent active date must be
            // today or yesterday for the streak to be "current".
            let currentStreak = 0;
            const mostRecentDate = activeDates[activeDates.length - 1];
            const gapToToday = daysBetween(mostRecentDate, today);

            if (gapToToday <= 1) {
                // There is an active streak that includes today or yesterday
                currentStreak = 1;
                for (let i = activeDates.length - 2; i >= 0; i--) {
                    const gap = daysBetween(activeDates[i], activeDates[i + 1]);
                    if (gap === 1) {
                        currentStreak++;
                    } else {
                        break; // Chain broken
                    }
                }
            }

            // --- Longest streak ---
            // Forward pass through all active dates
            let longestStreak = 1;
            let tempStreak = 1;

            for (let i = 1; i < activeDates.length; i++) {
                const gap = daysBetween(activeDates[i - 1], activeDates[i]);
                if (gap === 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
                longestStreak = Math.max(longestStreak, tempStreak);
            }

            // Current streak could also be the longest
            longestStreak = Math.max(longestStreak, currentStreak);

            console.log(`[AI Tracker] Streaks calculated: current=${currentStreak}, longest=${longestStreak}`);

            chrome.storage.local.set({
                current_streak: currentStreak,
                longest_streak: longestStreak
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[AI Tracker] Storage set error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve({ current_streak: currentStreak, longest_streak: longestStreak });
            });
        });
    });
}

// Update badge with today's count
async function updateBadge() {
    const today = getTodayDate();

    chrome.storage.local.get(['usage_stats'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[AI Tracker] Storage get error:', chrome.runtime.lastError);
            return;
        }

        const stats = result.usage_stats || {};
        const todayTotal = stats[today]?.total || 0;

        if (todayTotal > 0) {
            chrome.action.setBadgeText({ text: String(todayTotal) });
            chrome.action.setBadgeBackgroundColor({ color: '#26a641' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'MESSAGE_SENT') {
        const platform = message.platform;

        // Validate platform
        if (!SUPPORTED_PLATFORMS.includes(platform)) {
            console.error(`[AI Tracker] Invalid platform: ${platform}`);
            sendResponse({ success: false, error: 'Invalid platform' });
            return;
        }

        // Increment count for the platform
        incrementCount(platform)
            .then(async (newTotal) => {
                console.log(`[AI Tracker] ${platform} message counted. Today's total: ${newTotal}`);

                // Update badge
                await updateBadge();

                // Recalculate streaks
                await calculateStreaks();

                sendResponse({ success: true, total: newTotal });
            })
            .catch((error) => {
                console.error('[AI Tracker] Error incrementing count:', error);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate async response
        return true;
    }

    // Handle RECALCULATE_STREAKS message from popup
    if (message.type === 'RECALCULATE_STREAKS') {
        calculateStreaks()
            .then((streaks) => {
                console.log('[AI Tracker] Streaks recalculated:', streaks);
                sendResponse({ success: true, streaks });
            })
            .catch((error) => {
                console.error('[AI Tracker] Error recalculating streaks:', error);
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }
});

// Initialize badge on startup
chrome.runtime.onStartup.addListener(() => {
    console.log('[AI Tracker] Extension started');
    updateBadge();
    calculateStreaks();
});

// Initialize badge when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[AI Tracker] Extension installed/updated:', details.reason);
    updateBadge();
    calculateStreaks();
});

// Update badge when storage changes (e.g., from popup)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.usage_stats) {
        updateBadge();
    }
});

console.log('[AI Tracker] Background service worker initialized');

