// Storage utility functions for AI Contribution Tracker
// Handles all chrome.storage.local operations with proper data schema

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Increment the count for a specific platform for today
 * @param {string} platform - One of: 'chatgpt', 'claude', 'gemini', 'deepseek'
 */
async function incrementCount(platform) {
    const today = getTodayDate();

    return new Promise((resolve) => {
        chrome.storage.local.get(['usage_stats'], (result) => {
            const stats = result.usage_stats || {};

            // Initialize today's data if it doesn't exist
            if (!stats[today]) {
                stats[today] = {
                    chatgpt: 0,
                    claude: 0,
                    gemini: 0,
                    deepseek: 0,
                    total: 0
                };
            }

            // Increment the platform count
            stats[today][platform] = (stats[today][platform] || 0) + 1;

            // Recalculate total
            stats[today].total =
                stats[today].chatgpt +
                stats[today].claude +
                stats[today].gemini +
                stats[today].deepseek;

            // Save back to storage
            chrome.storage.local.set({ usage_stats: stats }, () => {
                resolve(stats[today].total);
            });
        });
    });
}

/**
 * Get all usage statistics
 */
async function getUsageStats() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['usage_stats', 'current_streak', 'longest_streak'], (result) => {
            resolve({
                usage_stats: result.usage_stats || {},
                current_streak: result.current_streak || 0,
                longest_streak: result.longest_streak || 0
            });
        });
    });
}

/**
 * Calculate current and longest streaks
 */
async function calculateStreaks() {
    const { usage_stats } = await getUsageStats();
    const dates = Object.keys(usage_stats).sort();

    if (dates.length === 0) {
        return { current_streak: 0, longest_streak: 0 };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const today = getTodayDate();
    const todayTime = new Date(today).getTime();

    // Check if today has activity
    const hasToday = usage_stats[today] && usage_stats[today].total > 0;

    // Calculate streaks by checking consecutive days
    for (let i = dates.length - 1; i >= 0; i--) {
        const currentDate = dates[i];
        const currentTime = new Date(currentDate).getTime();

        if (usage_stats[currentDate].total === 0) continue;

        if (i === dates.length - 1) {
            tempStreak = 1;
        } else {
            const prevDate = dates[i + 1];
            const prevTime = new Date(prevDate).getTime();
            const dayDiff = (prevTime - currentTime) / (1000 * 60 * 60 * 24);

            if (dayDiff === 1) {
                tempStreak++;
            } else {
                tempStreak = 1;
            }
        }

        longestStreak = Math.max(longestStreak, tempStreak);

        // Current streak only counts if it includes today or yesterday
        const daysSinceToday = (todayTime - currentTime) / (1000 * 60 * 60 * 24);
        if (daysSinceToday <= 1 && currentStreak === 0) {
            currentStreak = tempStreak;
        }
    }

    // Save streaks
    await new Promise((resolve) => {
        chrome.storage.local.set({
            current_streak: currentStreak,
            longest_streak: longestStreak
        }, resolve);
    });

    return { current_streak: currentStreak, longest_streak: longestStreak };
}

/**
 * Export all data as JSON
 */
async function exportData() {
    const data = await getUsageStats();
    return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON (merge strategy)
 */
async function importData(jsonString) {
    try {
        const importedData = JSON.parse(jsonString);
        const currentData = await getUsageStats();

        // Merge usage stats
        const mergedStats = { ...currentData.usage_stats };

        if (importedData.usage_stats) {
            Object.keys(importedData.usage_stats).forEach(date => {
                mergedStats[date] = importedData.usage_stats[date];
            });
        }

        // Save merged data
        await new Promise((resolve) => {
            chrome.storage.local.set({ usage_stats: mergedStats }, resolve);
        });

        // Recalculate streaks
        await calculateStreaks();

        return true;
    } catch (error) {
        console.error('Import failed:', error);
        return false;
    }
}

/**
 * Clear all data
 */
async function clearData() {
    return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
            resolve(true);
        });
    });
}

/**
 * Get today's total count
 */
async function getTodayTotal() {
    const today = getTodayDate();
    const { usage_stats } = await getUsageStats();
    return usage_stats[today]?.total || 0;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        incrementCount,
        getUsageStats,
        calculateStreaks,
        exportData,
        importData,
        clearData,
        getTodayTotal,
        getTodayDate
    };
}
