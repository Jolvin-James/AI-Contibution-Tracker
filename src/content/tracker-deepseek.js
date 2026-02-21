// DeepSeek Tracker - Content Script
// Detects when user sends messages on chat.deepseek.com
// Uses hybrid detection: action-based (button + Enter) + DOM count-based backup

(function () {
    'use strict';

    // Guard: chrome runtime must be available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('[AI Tracker] Chrome runtime not available');
        return;
    }

    console.log('[AI Tracker] DeepSeek tracker initialized');

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
                platform: 'deepseek'
            }, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    if (lastError.message.includes('context invalidated')) return;
                    console.error('[AI Tracker] Message send error:', lastError.message);
                    return;
                }
                if (response?.success) {
                    console.log(`[AI Tracker] DeepSeek message counted (${source}). Total:`, response.total);
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
    function setupSendButtonListener() {
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Walk up from clicked element to find a matching button
            const button = target.closest('button');
            if (!button) return;

            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const id = (button.id || '').toLowerCase();
            const className = (button.className || '').toLowerCase();

            // Match DeepSeek's send button by common attributes
            const isSendButton =
                ariaLabel.includes('send') ||
                ariaLabel.includes('submit') ||
                id.includes('send') ||
                className.includes('send');

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
    function setupEnterKeyListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }

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

            console.log('[AI Tracker] Enter key pressed in input');
            countMessage('enter');
        }, true); // Capture phase

        console.log('[AI Tracker] Enter key listener attached');
    }

    // =========================================================================
    // STRATEGY 3: DOM Count-Based Detection (Backup)
    // =========================================================================
    let debounceTimer = null;

    /**
     * Queries the DOM for user message elements using known DeepSeek selectors.
     */
    function queryUserMessages() {
        const selectorSets = [
            '[data-message-author-role="user"]',
            '[data-role="user"]',
            '[role="user"]',
            '.message.user',
            '[class*="user-message"]',
            '[class*="UserMessage"]',
            '[class*="user_message"]',
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

        // Last resort: filter elements with 'user' in their class
        const allMessages = document.querySelectorAll('[class*="message"], [class*="Message"]');
        const userMessages = Array.from(allMessages).filter(msg => {
            const classes = (msg.className || '').toLowerCase();
            const role = (msg.getAttribute('role') || '').toLowerCase();
            return classes.includes('user') || role === 'user';
        });

        return userMessages;
    }

    function scanForNewMessages() {
        // Check for SPA navigation first
        resetIfNavigated();

        const userMessageElements = queryUserMessages();

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
        // If the count DROPPED, the user switched conversations (SPA navigation).
        if (currentCount < processedMessageCount) {
            processedMessageCount = currentCount;
            baselineEstablished = true;
            console.log('[AI Tracker] Message count dropped — baseline reset to', currentCount);
            return;
        }

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
        // Disconnect any existing observer to prevent duplicates
        if (observer) observer.disconnect();

        const targetNode = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        if (targetNode) {
            const existingMessages = queryUserMessages();
            processedMessageCount = existingMessages.length;
            baselineEstablished = true;
            lastObservedUrl = window.location.href;

            observer = new MutationObserver(handleMutations);
            observer.observe(targetNode, {
                childList: true,
                subtree: true
            });
            console.log('[AI Tracker] DeepSeek DOM observer started (baseline:', processedMessageCount, 'messages)');
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

    // Pause/resume observer when tab visibility changes to save resources
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (observer) observer.disconnect();
            console.log('[AI Tracker] DeepSeek observer paused');
        } else {
            startObserving();
            console.log('[AI Tracker] DeepSeek observer resumed');
        }
    });
})();
