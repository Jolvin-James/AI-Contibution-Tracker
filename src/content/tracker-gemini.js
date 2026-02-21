// Gemini Tracker - Content Script
// Detects when user sends messages on gemini.google.com
// Uses action-based detection (button click + Enter key) for reliability

(function () {
    'use strict';

    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('[AI Tracker] Chrome runtime not available');
        return;
    }

    console.log('[AI Tracker] Gemini tracker initialized');

    // --- State ---
    let lastCountedTime = 0;
    const DEBOUNCE_MS = 4000; // Increased to prevent double-counting with delayed DOM scan
    let observer = null;
    let processedMessageCount = 0; // Track count of user messages seen in DOM
    let baselineEstablished = false; // Whether initial page-load baseline is set
    let lastObservedUrl = window.location.href; // Track SPA navigation

    // --- Utility: Send count to background ---
    function countMessage(source) {
        const now = Date.now();
        if (now - lastCountedTime < DEBOUNCE_MS) {
            return; // Debounce: prevent double-counting from multiple strategies
        }
        lastCountedTime = now;

        if (!chrome.runtime?.id) {
            return; // Extension context invalidated
        }

        try {
            chrome.runtime.sendMessage({
                type: 'MESSAGE_SENT',
                platform: 'gemini'
            }, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    if (lastError.message.includes('context invalidated')) return;
                    console.error('[AI Tracker] Message send error:', lastError.message);
                    return;
                }
                if (response?.success) {
                    console.log(`[AI Tracker] Gemini message counted (${source}). Total:`, response.total);
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
    // Uses event delegation on document to catch clicks on Gemini's send button
    // even when the button is dynamically re-rendered.
    function setupSendButtonListener() {
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Walk up from clicked element to find a matching button
            const button = target.closest('button');
            if (!button) return;

            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const matTooltip = (button.getAttribute('mattooltip') || '').toLowerCase();

            // Only match explicit send-related attributes — avoid broad class matching
            const isSendButton =
                ariaLabel.includes('send') ||
                matTooltip.includes('send') ||
                ariaLabel.includes('submit');

            if (isSendButton) {
                console.log('[AI Tracker] Send button clicked');
                countMessage('button');
            }
        }, true); // Capture phase

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
                activeEl.getAttribute('contenteditable') === 'true' ||
                activeEl.getAttribute('role') === 'textbox' ||
                activeEl.closest('[contenteditable="true"]') ||
                activeEl.closest('[role="textbox"]');

            if (!isEditable) return;

            // Check input has actual content
            const text = (activeEl.textContent || activeEl.value || '').trim();
            if (text.length > 0) {
                console.log('[AI Tracker] Enter key pressed in input');
                countMessage('enter');
            }
        }, true); // Capture phase

        console.log('[AI Tracker] Enter key listener attached');
    }

    // =========================================================================
    // STRATEGY 3: DOM Scan — Count-based change detection (conservative)
    // =========================================================================
    // Instead of trying to match specific selectors and risking false positives,
    // we only count a message when the NUMBER of user-message-like elements
    // increases — meaning a brand new message appeared in the DOM.
    let debounceTimer = null;

    function scanForNewMessages() {
        // Check for SPA navigation first
        resetIfNavigated();

        // Try specific Gemini selectors for user messages
        const selectorSets = [
            '.user-query-content',
            '.query-text',
            '.user-query',
            '[data-message-author-role="user"]',
            '[data-test-id="user-query"]',
            '[data-message-author="user"]',
        ];

        let userMessageElements = [];

        for (const selector of selectorSets) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    userMessageElements = elements;
                    break;
                }
            } catch (e) {
                // Invalid selector, skip
            }
        }

        if (userMessageElements.length === 0) {
            if (processedMessageCount > 0) {
                processedMessageCount = 0;
                baselineEstablished = false;
                console.log('[AI Tracker] Messages disappeared — conversation change detected');
            }
            return;
        }

        const currentCount = userMessageElements.length;

        // CONVERSATION CHANGE DETECTION:
        if (currentCount < processedMessageCount) {
            processedMessageCount = currentCount;
            baselineEstablished = true;
            console.log('[AI Tracker] Message count dropped — baseline reset to', currentCount);
            return;
        }

        // Only count if the number of messages INCREASED (new message appeared)
        if (currentCount > processedMessageCount) {
            processedMessageCount = currentCount;

            if (!baselineEstablished) {
                baselineEstablished = true;
                console.log('[AI Tracker] Initial baseline captured:', currentCount);
                return;
            }

            console.log('[AI Tracker] New user message detected via DOM scan');
            countMessage('dom-scan');
        }
    }

    function handleMutations() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            scanForNewMessages();
        }, 2500);
    }

    function startObserving() {
        // Disconnect any existing observer
        if (observer) observer.disconnect();

        const targetNode = document.querySelector('main') || document.body;
        if (targetNode) {
            // Set baseline count BEFORE starting observer so initial load isn't counted
            const selectorSets = [
                '.user-query-content', '.query-text', '.user-query',
                '[data-message-author-role="user"]', '[data-test-id="user-query"]',
                '[data-message-author="user"]',
            ];
            processedMessageCount = 0;
            for (const selector of selectorSets) {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        processedMessageCount = elements.length;
                        break;
                    }
                } catch (e) { /* skip */ }
            }

            baselineEstablished = true;
            lastObservedUrl = window.location.href;

            observer = new MutationObserver(handleMutations);
            observer.observe(targetNode, {
                childList: true,
                subtree: true
            });
            console.log('[AI Tracker] Gemini DOM observer started (baseline:', processedMessageCount, 'messages)');
        } else {
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

    // Pause/resume observer when tab visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (observer) observer.disconnect();
            console.log('[AI Tracker] Gemini observer paused');
        } else {
            startObserving();
            console.log('[AI Tracker] Gemini observer resumed');
        }
    });
})();