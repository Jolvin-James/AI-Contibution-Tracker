// AI Contribution Tracker - Popup JavaScript
// Handles data visualization and user interactions

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Get color level based on count
function getColorLevel(count) {
    if (count === 0) return 0;
    if (count <= 4) return 1;
    if (count <= 9) return 2;
    if (count <= 19) return 3;
    return 4;
}

// Generate week-aligned array of last ~26 weeks (6 months)
function getLast26Weeks() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday

    // End at today, start 26 weeks back aligned to Sunday
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - dayOfWeek - (25 * 7));

    const days = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        days.push(`${year}-${month}-${day}`);
    }

    return days;
}

// Render heatmap with vertical (top-to-bottom) week columns and month labels
function renderHeatmap(usageStats) {
    const heatmapContainer = document.getElementById('heatmap');
    heatmapContainer.innerHTML = '';

    const days = getLast26Weeks();
    const totalWeeks = Math.ceil(days.length / 7);

    // — Month labels row —
    const monthRow = document.createElement('div');
    monthRow.className = 'heatmap-months';

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Spacer for day-label column
    const spacer = document.createElement('span');
    spacer.className = 'heatmap-month-spacer';
    monthRow.appendChild(spacer);

    let lastMonth = -1;
    for (let w = 0; w < totalWeeks; w++) {
        const firstDayIdx = w * 7;
        if (firstDayIdx >= days.length) break;
        const dateObj = new Date(days[firstDayIdx]);
        const m = dateObj.getMonth();
        const label = document.createElement('span');
        label.className = 'heatmap-month-label';
        if (m !== lastMonth) {
            label.textContent = monthNames[m];
            lastMonth = m;
        }
        monthRow.appendChild(label);
    }
    heatmapContainer.appendChild(monthRow);

    // — Grid wrapper (day labels + cells) —
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'heatmap-grid-wrapper';

    // Day-of-week labels column
    const dayLabels = document.createElement('div');
    dayLabels.className = 'heatmap-day-labels';
    const dayAbbr = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    dayAbbr.forEach(label => {
        const el = document.createElement('span');
        el.className = 'heatmap-day-label';
        el.textContent = label;
        dayLabels.appendChild(el);
    });
    gridWrapper.appendChild(dayLabels);

    // Cell grid — flows top-to-bottom per column (grid-auto-flow: column)
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    grid.style.gridTemplateColumns = `repeat(${totalWeeks}, 1fr)`;

    days.forEach(date => {
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';

        const dayData = usageStats[date];
        const count = dayData?.total || 0;
        const level = getColorLevel(count);

        cell.classList.add(`level-${level}`);
        cell.dataset.date = date;
        cell.dataset.count = count;

        cell.addEventListener('mouseenter', (e) => {
            showTooltip(e, date, count);
        });

        cell.addEventListener('mouseleave', () => {
            hideTooltip();
        });

        grid.appendChild(cell);
    });

    gridWrapper.appendChild(grid);
    heatmapContainer.appendChild(gridWrapper);
}

// Tooltip management
let tooltipElement = null;

function showTooltip(event, date, count) {
    hideTooltip();

    tooltipElement = document.createElement('div');
    tooltipElement.className = 'tooltip';
    tooltipElement.textContent = `${formatDate(date)}: ${count} contribution${count !== 1 ? 's' : ''}`;

    document.body.appendChild(tooltipElement);

    const rect = event.target.getBoundingClientRect();
    tooltipElement.style.position = 'fixed';
    tooltipElement.style.left = `${rect.left + rect.width / 2 - tooltipElement.offsetWidth / 2}px`;
    tooltipElement.style.top = `${rect.top - tooltipElement.offsetHeight - 8}px`;
}

function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }
}

// Update summary cards
function updateSummaryCards(usageStats, currentStreak, longestStreak) {
    const today = getTodayDate();
    const todayData = usageStats[today];
    const todayCount = todayData?.total || 0;

    // Calculate total contributions
    let totalCount = 0;
    Object.keys(usageStats).forEach(date => {
        totalCount += usageStats[date].total || 0;
    });

    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('currentStreak').innerHTML = `${currentStreak} <span class="card-unit">days</span>`;
    document.getElementById('totalCount').textContent = totalCount.toLocaleString();
}

// Update platform breakdown
function updatePlatformBreakdown(usageStats) {
    const platforms = {
        chatgpt: 0,
        claude: 0,
        gemini: 0,
        deepseek: 0
    };

    // Aggregate platform counts
    Object.keys(usageStats).forEach(date => {
        const dayData = usageStats[date];
        platforms.chatgpt += dayData.chatgpt || 0;
        platforms.claude += dayData.claude || 0;
        platforms.gemini += dayData.gemini || 0;
        platforms.deepseek += dayData.deepseek || 0;
    });

    const total = platforms.chatgpt + platforms.claude + platforms.gemini + platforms.deepseek;

    // Update counts and bars
    Object.keys(platforms).forEach(platform => {
        const count = platforms[platform];
        const percentage = total > 0 ? (count / total) * 100 : 0;

        document.getElementById(`${platform}Count`).textContent = count;
        document.getElementById(`${platform}Bar`).style.width = `${percentage}%`;
    });
}

// Load and display all data
async function loadData() {
    chrome.storage.local.get(['usage_stats', 'current_streak', 'longest_streak'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[AI Tracker] Error loading data:', chrome.runtime.lastError);
            return;
        }

        const usageStats = result.usage_stats || {};
        const currentStreak = result.current_streak || 0;
        const longestStreak = result.longest_streak || 0;

        updateSummaryCards(usageStats, currentStreak, longestStreak);
        renderHeatmap(usageStats);
        updatePlatformBreakdown(usageStats);
    });
}

// ─── Status Modal Helper ───
function showStatusModal(title, message, isError = false) {
    const modal = document.getElementById('statusModal');
    const titleEl = document.getElementById('statusModalTitle');
    const msgEl = document.getElementById('statusModalMessage');
    const okBtn = document.getElementById('statusModalOkBtn');

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (isError) {
        titleEl.style.color = 'var(--danger)';
        okBtn.style.background = 'var(--danger)';
        okBtn.style.borderColor = 'var(--danger)';
        okBtn.style.color = 'var(--white)';
    } else {
        titleEl.style.color = 'var(--text-primary)';
        // Reset to primary button styles (defined in CSS)
        okBtn.style.background = '';
        okBtn.style.borderColor = '';
        okBtn.style.color = '';
    }

    modal.classList.remove('hidden');
}

// ─── Export data ───
function exportData() {
    chrome.storage.local.get(['usage_stats', 'current_streak', 'longest_streak'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('[AI Tracker] Error exporting data:', chrome.runtime.lastError);
            showStatusModal('Export Failed', 'Failed to export data. Please try again.', true);
            return;
        }

        const data = {
            usage_stats: result.usage_stats || {},
            current_streak: result.current_streak || 0,
            longest_streak: result.longest_streak || 0,
            exported_at: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-tracker-export-${getTodayDate()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    });
}

// ─── Import data ───
function importData(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);

            // Validate imported data structure
            if (!importedData.usage_stats || typeof importedData.usage_stats !== 'object') {
                throw new Error('Invalid data format: missing usage_stats');
            }

            // Merge with existing data
            chrome.storage.local.get(['usage_stats'], (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[AI Tracker] Error importing data:', chrome.runtime.lastError);
                    showStatusModal('Import Failed', 'Failed to import data. Please try again.', true);
                    return;
                }

                const currentStats = result.usage_stats || {};
                const mergedStats = { ...currentStats };

                Object.keys(importedData.usage_stats).forEach(date => {
                    mergedStats[date] = importedData.usage_stats[date];
                });

                chrome.storage.local.set({ usage_stats: mergedStats }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[AI Tracker] Error saving imported data:', chrome.runtime.lastError);
                        showStatusModal('Import Failed', 'Failed to save imported data. Please try again.', true);
                        return;
                    }

                    // Recalculate streaks
                    chrome.runtime.sendMessage({ type: 'RECALCULATE_STREAKS' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('[AI Tracker] Error recalculating streaks:', chrome.runtime.lastError);
                        }
                    });

                    // Reload data
                    loadData();
                    showStatusModal('Import Successful', 'Data imported successfully!');
                });
            });
        } catch (error) {
            showStatusModal('Import Failed', 'Failed to import data. Please check the file format.', true);
            console.error('Import error:', error);
        }
    };

    reader.onerror = () => {
        showStatusModal('Import Failed', 'Failed to read file. Please try again.', true);
        console.error('File read error:', reader.error);
    };

    reader.readAsText(file);
}

// ─── Clear all data ───
function clearData() {
    const modal = document.getElementById('confirmationModal');
    modal.classList.remove('hidden');
}

// ─── Event Listeners ───
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    loadData();

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    // Import button
    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
    }

    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importData(file);
            }
        });
    }

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearData);

    // Settings button (placeholder)
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            showStatusModal('Coming Soon', 'Settings feature is coming soon!');
        });
    }

    // Listen for storage changes to update in real-time
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            loadData();
        }
    });

    // ─── Status Modal Listeners ───
    const statusModalClose = document.getElementById('statusModalCloseBtn');
    if (statusModalClose) {
        statusModalClose.addEventListener('click', () => {
            document.getElementById('statusModal').classList.add('hidden');
        });
    }

    const statusModalOk = document.getElementById('statusModalOkBtn');
    if (statusModalOk) {
        statusModalOk.addEventListener('click', () => {
            document.getElementById('statusModal').classList.add('hidden');
        });
    }

    const statusModal = document.getElementById('statusModal');
    if (statusModal) {
        statusModal.addEventListener('click', (e) => {
            if (e.target === statusModal) {
                statusModal.classList.add('hidden');
            }
        });
    }

    // ─── Confirmation Modal Listeners ───
    const modalCancel = document.getElementById('modalCancelBtn');
    if (modalCancel) {
        modalCancel.addEventListener('click', () => {
            document.getElementById('confirmationModal').classList.add('hidden');
        });
    }

    const modalClose = document.getElementById('modalCloseBtn');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            document.getElementById('confirmationModal').classList.add('hidden');
        });
    }

    const modalConfirm = document.getElementById('modalConfirmBtn');
    if (modalConfirm) {
        modalConfirm.addEventListener('click', () => {
            chrome.storage.local.clear(() => {
                if (chrome.runtime.lastError) {
                    console.error('[AI Tracker] Error clearing data:', chrome.runtime.lastError);
                    showStatusModal('Clear Failed', 'Failed to clear data. Please try again.', true);
                    return;
                }

                loadData();
                document.getElementById('confirmationModal').classList.add('hidden');
            });
        });
    }

    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.addEventListener('click', (e) => {
            if (e.target === confirmationModal) {
                confirmationModal.classList.add('hidden');
            }
        });
    }
});
