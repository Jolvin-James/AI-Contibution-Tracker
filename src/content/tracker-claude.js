// Claude Tracker - Content Script
// Detects when user sends messages on claude.ai
// Uses hybrid detection: action-based (button + Enter) + DOM count-based backup

(function () {
    'use strict';

    // Guard: chrome runtime must be available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('[AI Tracker] Chrome runtime not available');
        return;
    }

    console.log('[AI Tracker] Claude tracker initialized');

    // --- State ---
    let lastCountedTime = 0;
    const DEBOUNCE_MS = 2000; // Minimum gap between counted messages
    let observer = null;
    let processedMessageCount = 0; // Baseline count of user messages in DOM
    let baselineEstablished = false; // Whether initial page-load baseline is set
    let lastObservedUrl = window.location.href; // Track SPA navigation

    // --- Utility: Send count to background ---
    function countMessage(source) {
        const now = Date.now();
        if (now - lastCountedTime < DEBOUNCE_MS) {
            return; // Debounce: prevent double-counting from multiple strategies
        }
        lastCountedTime = now;

        // Guard against invalidated extension context
        if (!chrome.runtime?.id) {
            return;
        }

        try {
            chrome.runtime.sendMessage({
                type: 'MESSAGE_SENT',
                platform: 'claude'
            }, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    if (lastError.message.includes('context invalidated')) return;
                    console.error('[AI Tracker] Message send error:', lastError.message);
                    return;
                }
                if (response?.success) {
                    console.log(`[AI Tracker] Claude message counted (${source}). Total:`, response.total);
                } else {
                    console.error('[AI Tracker] Failed to count message:', response?.error);
                }
            });
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.log('[AI Tracker] Context invalidated. Stopping tracker.');
                if (observer) observer.disconnect();
            } else {
                console.error('[AI Tracker] Exception sending message:', error);
            }
        }
    }

    // =========================================================================
    // SPA NAVIGATION DETECTION
    // =========================================================================
    // Claude is a Single Page App — the content script persists across
    // conversation switches. We must reset the baseline when the URL changes
    // to avoid the stale count from the previous conversation blocking detection.
    function resetIfNavigated() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastObservedUrl) {
            lastObservedUrl = currentUrl;
            processedMessageCount = 0;
            baselineEstablished = false;
            console.log('[AI Tracker] SPA navigation detected, baseline reset');
        }
    }

    // =========================================================================
    // STRATEGY 1: Send Button Click (Event Delegation)
    // =========================================================================
    // Uses event delegation on document to catch clicks on Claude's send button
    // even when the button is dynamically re-rendered.
    function setupSendButtonListener() {
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Walk up from clicked element to find a matching button
            const button = target.closest('button');
            if (!button) return;

            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

            // Only match explicit send-related attributes
            const isSendButton =
                ariaLabel.includes('send') ||
                ariaLabel.includes('submit');

            // Also check for SVG icon-based send buttons (no aria-label)
            // These are common in modern chat UIs
            if (!isSendButton) {
                const svg = button.querySelector('svg');
                const nearInput = button.closest('form, [class*="input"], [class*="composer"], [class*="Input"], [class*="Composer"]');
                // If it's a button with an SVG inside a form/input area, likely a send button
                if (svg && nearInput && !ariaLabel.includes('attach') && !ariaLabel.includes('upload')) {
                    // Only match if button is not a toggle, menu, or other non-send action
                    const isLikelySend = !ariaLabel.includes('menu') &&
                        !ariaLabel.includes('settings') &&
                        !ariaLabel.includes('close') &&
                        !ariaLabel.includes('cancel');
                    if (isLikelySend) {
                        console.log('[AI Tracker] Send button clicked (SVG heuristic)');
                        countMessage('button');
                        return;
                    }
                }
            }

            if (isSendButton) {
                console.log('[AI Tracker] Send button clicked');
                countMessage('button');
            }
        }, true); // Capture phase to intercept before any stopPropagation

        console.log('[AI Tracker] Send button listener attached');
    }

    // =========================================================================
    // STRATEGY 2: Enter Key Interception
    // =========================================================================
    // Standard chat behavior: Enter (without Shift) sends the message.
    function setupEnterKeyListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }

            // Only count if the focused element is an input/editable area
            const activeEl = document.activeElement;
            if (!activeEl) return;

            const isEditable =
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'INPUT' ||
                activeEl.getAttribute('contenteditable') === 'true' ||
                activeEl.getAttribute('role') === 'textbox' ||
                activeEl.closest('[contenteditable="true"]') ||
                activeEl.closest('[role="textbox"]') ||
                activeEl.closest('.ProseMirror') ||
                activeEl.closest('[class*="editor"]') ||
                activeEl.closest('[class*="Editor"]');

            if (!isEditable) return;

            // Count the message — if Enter is pressed in an editable area,
            // the user is almost certainly sending a message. We don't check
            // text content because the editor may clear it before our handler
            // sees it on subsequent messages.
            console.log('[AI Tracker] Enter key pressed in input');
            countMessage('enter');
        }, true); // Capture phase

        console.log('[AI Tracker] Enter key listener attached');
    }

    // =========================================================================
    // STRATEGY 3: DOM Count-Based Detection (Backup)
    // =========================================================================
    // Only fires when the NUMBER of user message elements increases,
    // preventing false positives from streaming response mutations.
    let debounceTimer = null;

    /**
     * Queries the DOM for user message elements using known Claude selectors.
     * Returns the NodeList/Array of matched elements.
     */
    function queryUserMessages() {
        const selectorSets = [
            '[data-testid="user-message"]',
            '[data-is-user-message="true"]',
            '.font-user-message',
            '[class*="UserMessage"]',
        ];

        for (const selector of selectorSets) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    return elements;
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }

        return [];
    }

    function scanForNewMessages() {
        // Check for SPA navigation first
        resetIfNavigated();

        const userMessageElements = queryUserMessages();

        // If no elements found, nothing to do
        if (userMessageElements.length === 0) {
            // If we previously had messages and now we don't, conversation changed
            if (processedMessageCount > 0) {
                processedMessageCount = 0;
                baselineEstablished = false;
                console.log('[AI Tracker] Messages disappeared — conversation change detected');
            }
            return;
        }

        const currentCount = userMessageElements.length;

        // CONVERSATION CHANGE DETECTION:
        // If the count DROPPED, the user switched conversations (SPA navigation).
        // Reset baseline to current count to avoid blocking future detections.
        if (currentCount < processedMessageCount) {
            processedMessageCount = currentCount;
            baselineEstablished = true;
            console.log('[AI Tracker] Message count dropped — baseline reset to', currentCount);
            return;
        }

        // Only fire when the count genuinely increases beyond the baseline
        if (currentCount > processedMessageCount) {
            processedMessageCount = currentCount;

            // On the very first scan after page load, just capture baseline
            if (!baselineEstablished) {
                baselineEstablished = true;
                console.log('[AI Tracker] Initial baseline captured:', currentCount);
                return;
            }

            // Genuine new message detected
            console.log('[AI Tracker] New user message detected via DOM scan');
            countMessage('dom-scan');
        }
    }

    function handleMutations() {
        // True debounce: reset timer on every mutation so we only fire
        // once the DOM has settled (after streaming completes)
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            scanForNewMessages();
        }, 2500);
    }

    function startObserving() {
        // Disconnect any existing observer to prevent duplicates
        if (observer) observer.disconnect();

        const targetNode = document.querySelector('main') || document.body;
        if (targetNode) {
            // Set baseline count BEFORE starting observer
            // so initial page load messages are not counted
            const existingMessages = queryUserMessages();
            processedMessageCount = existingMessages.length;
            baselineEstablished = true;
            lastObservedUrl = window.location.href;

            observer = new MutationObserver(handleMutations);
            observer.observe(targetNode, {
                childList: true,
                subtree: true
            });
            console.log('[AI Tracker] Claude DOM observer started (baseline:', processedMessageCount, 'messages)');
        } else {
            // Retry after a short delay if main container not yet available
            setTimeout(startObserving, 1000);
        }
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    setupSendButtonListener();
    setupEnterKeyListener();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }

    // Pause/resume observer when tab visibility changes to save resources
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (observer) observer.disconnect();
            console.log('[AI Tracker] Claude observer paused');
        } else {
            startObserving();
            console.log('[AI Tracker] Claude observer resumed');
        }
    });
})();
