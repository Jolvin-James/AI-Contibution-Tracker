// ChatGPT Tracker - Content Script
// Detects when user sends messages on chatgpt.com

(function () {
    'use strict';

    if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('[AI Tracker] Chrome runtime not available');
        return;
    }

    console.log('[AI Tracker] ChatGPT tracker initialized');

    let processedMessages = new Set();
    let debounceTimer = null; // Timer handle for true debouncing

    // Generate a deterministic hash for the message
    // specific enough to distinguish messages, but stable across renders
    function generateMessageId(messageElement, index) {
        const text = messageElement.textContent || '';
        // Use text length + first 20 chars + last 20 chars + index in list
        // This avoids holding the entire text in memory
        const preview = text.slice(0, 20) + text.slice(-20);
        return `${index}_${text.length}_${preview}`;
    }

    function processMessages() {
        const userMessages = document.querySelectorAll('[data-message-author-role="user"]');

        if (userMessages.length === 0) return;

        // Get the very last message
        const lastMessageIndex = userMessages.length - 1;
        const lastMessage = userMessages[lastMessageIndex];

        // Generate ID based on Content and Index (NOT time or offset)
        const messageId = generateMessageId(lastMessage, lastMessageIndex);

        if (processedMessages.has(messageId)) {
            return;
        }

        // Add to set
        processedMessages.add(messageId);

        // Memory management: Keep set size manageable
        if (processedMessages.size > 50) {
            const firstItem = processedMessages.values().next().value;
            processedMessages.delete(firstItem);
        }

        // Send to background
        try {
            chrome.runtime.sendMessage({
                type: 'MESSAGE_SENT',
                platform: 'chatgpt'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Suppress harmless errors if popup is closed
                    // console.warn('Runtime error:', chrome.runtime.lastError.message); 
                } else if (response?.success) {
                    console.log('[AI Tracker] Counted. Total:', response.total);
                }
            });
        } catch (e) {
            // Context invalidated handling
        }
    }

    // True Debounce: Reset timer on every mutation
    function handleMutations(mutations) {
        if (debounceTimer) clearTimeout(debounceTimer);

        // Wait for 2 seconds of silence before processing. 
        // ChatGPT DOM updates frequently; 2s ensures the message is "settled".
        debounceTimer = setTimeout(() => {
            processMessages();
        }, 2000);
    }

    const observer = new MutationObserver(handleMutations);

    function startObserving() {
        const mainContainer = document.querySelector('main') || document.body;
        if (mainContainer) {
            observer.observe(mainContainer, { childList: true, subtree: true });
        } else {
            setTimeout(startObserving, 1000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }
})();

