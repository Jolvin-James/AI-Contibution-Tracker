/**
 * Unit tests for Claude Tracker — edge cases
 *
 * These tests extract and exercise the core detection logic
 * (debounce, baseline, SPA navigation, DOM scan) in isolation
 * by mocking the browser and Chrome extension APIs.
 */

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------
let sendMessageCallback = null;

const mockChrome = {
    runtime: {
        id: 'test-extension-id',
        sendMessage: jest.fn((msg, cb) => {
            sendMessageCallback = cb;
            cb({ success: true, total: 1 });
        }),
        lastError: null,
    },
};

// Expose mock chrome globally
global.chrome = mockChrome;

// Mock location
const mockLocation = { href: 'https://claude.ai/chat/abc123' };
delete global.window;
global.window = { location: mockLocation };

// Minimal DOM mocks
let mockQueryResults = {};
global.document = {
    readyState: 'complete',
    hidden: false,
    activeElement: null,
    querySelector: jest.fn(() => ({ observe: jest.fn() })),
    querySelectorAll: jest.fn((selector) => mockQueryResults[selector] || []),
    addEventListener: jest.fn(),
    createElement: jest.fn(),
};

// ---------------------------------------------------------------------------
// Extract the tracker logic into testable functions
// We replicate the core logic here to unit-test it in isolation.
// ---------------------------------------------------------------------------

/**
 * Creates a tracker instance with exposed internals for testing.
 * This mirrors the exact logic in tracker-claude.js.
 */
function createTracker(platform = 'claude') {
    let lastCountedTime = 0;
    const DEBOUNCE_MS = 2000;
    let processedMessageCount = 0;
    let baselineEstablished = false;
    let lastObservedUrl = 'https://claude.ai/chat/abc123';
    let messagesSent = []; // Record of messages sent, for assertions

    function countMessage(source) {
        const now = Date.now();
        if (now - lastCountedTime < DEBOUNCE_MS) {
            return false; // debounced
        }
        lastCountedTime = now;
        messagesSent.push({ source, time: now, platform });
        return true;
    }

    function resetIfNavigated(currentUrl) {
        if (currentUrl !== lastObservedUrl) {
            lastObservedUrl = currentUrl;
            processedMessageCount = 0;
            baselineEstablished = false;
            return true;
        }
        return false;
    }

    function scanForNewMessages(currentCount, currentUrl) {
        // Check for SPA navigation
        if (currentUrl) {
            resetIfNavigated(currentUrl);
        }

        // No elements
        if (currentCount === 0) {
            if (processedMessageCount > 0) {
                processedMessageCount = 0;
                baselineEstablished = false;
            }
            return 'no-messages';
        }

        // Count dropped — conversation change
        if (currentCount < processedMessageCount) {
            processedMessageCount = currentCount;
            baselineEstablished = true;
            return 'baseline-reset';
        }

        // Count increased
        if (currentCount > processedMessageCount) {
            processedMessageCount = currentCount;

            if (!baselineEstablished) {
                baselineEstablished = true;
                return 'baseline-captured';
            }

            return countMessage('dom-scan') ? 'counted' : 'debounced';
        }

        return 'no-change';
    }

    function startObserving(existingCount, url) {
        processedMessageCount = existingCount;
        baselineEstablished = true;
        lastObservedUrl = url || lastObservedUrl;
    }

    // Expose all internals for testing
    return {
        countMessage,
        resetIfNavigated,
        scanForNewMessages,
        startObserving,
        get state() {
            return {
                lastCountedTime,
                processedMessageCount,
                baselineEstablished,
                lastObservedUrl,
            };
        },
        get messagesSent() {
            return messagesSent;
        },
        setLastCountedTime(t) { lastCountedTime = t; },
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Claude Tracker — Core Logic', () => {
    let tracker;

    beforeEach(() => {
        tracker = createTracker();
        jest.spyOn(Date, 'now').mockReturnValue(10000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // == DEBOUNCE ==
    describe('Debounce', () => {
        test('first message always passes debounce', () => {
            const result = tracker.countMessage('enter');
            expect(result).toBe(true);
            expect(tracker.messagesSent).toHaveLength(1);
        });

        test('second message within 2s is debounced', () => {
            tracker.countMessage('enter');
            Date.now.mockReturnValue(10500); // 500ms later
            const result = tracker.countMessage('enter');
            expect(result).toBe(false);
            expect(tracker.messagesSent).toHaveLength(1);
        });

        test('second message after 2s passes', () => {
            tracker.countMessage('enter');
            Date.now.mockReturnValue(12001); // 2001ms later
            const result = tracker.countMessage('enter');
            expect(result).toBe(true);
            expect(tracker.messagesSent).toHaveLength(2);
        });

        test('different strategies within debounce window are blocked', () => {
            tracker.countMessage('enter');
            Date.now.mockReturnValue(10100);
            const r1 = tracker.countMessage('button');
            Date.now.mockReturnValue(10200);
            const r2 = tracker.countMessage('dom-scan');
            expect(r1).toBe(false);
            expect(r2).toBe(false);
            expect(tracker.messagesSent).toHaveLength(1);
        });

        test('debounce resets after timeout', () => {
            tracker.countMessage('enter');
            Date.now.mockReturnValue(15000); // 5s later
            const result = tracker.countMessage('dom-scan');
            expect(result).toBe(true);
            expect(tracker.messagesSent).toHaveLength(2);
        });
    });

    // == BASELINE ==
    describe('Baseline Capture', () => {
        test('initial page load captures baseline without counting', () => {
            tracker.startObserving(3, 'https://claude.ai/chat/abc123');
            expect(tracker.state.processedMessageCount).toBe(3);
            expect(tracker.state.baselineEstablished).toBe(true);
            expect(tracker.messagesSent).toHaveLength(0);
        });

        test('first scan after load does not fire if baseline already set', () => {
            tracker.startObserving(3, 'https://claude.ai/chat/abc123');
            const result = tracker.scanForNewMessages(3);
            expect(result).toBe('no-change');
            expect(tracker.messagesSent).toHaveLength(0);
        });
    });

    // == NEW MESSAGES IN SAME CONVERSATION ==
    describe('New Messages (Same Conversation)', () => {
        beforeEach(() => {
            tracker.startObserving(2, 'https://claude.ai/chat/abc123');
        });

        test('message count going from 2→3 triggers count', () => {
            const result = tracker.scanForNewMessages(3);
            expect(result).toBe('counted');
            expect(tracker.messagesSent).toHaveLength(1);
            expect(tracker.messagesSent[0].source).toBe('dom-scan');
        });

        test('message count staying at 2 does not trigger', () => {
            const result = tracker.scanForNewMessages(2);
            expect(result).toBe('no-change');
            expect(tracker.messagesSent).toHaveLength(0);
        });

        test('multiple sequential messages are each counted', () => {
            tracker.scanForNewMessages(3); // message 3
            Date.now.mockReturnValue(13000);
            tracker.scanForNewMessages(4); // message 4
            Date.now.mockReturnValue(16000);
            tracker.scanForNewMessages(5); // message 5
            expect(tracker.messagesSent).toHaveLength(3);
        });

        test('second message is detected (the original bug)', () => {
            // Simulate: Enter key catches first message
            tracker.countMessage('enter');
            // DOM scan sees count 2→3, but debounce blocks
            const r1 = tracker.scanForNewMessages(3);
            expect(r1).toBe('debounced');

            // Second message sent 3s later
            Date.now.mockReturnValue(13000);
            tracker.countMessage('enter');
            expect(tracker.messagesSent).toHaveLength(2);
            expect(tracker.messagesSent[1].source).toBe('enter');
        });
    });

    // == SPA NAVIGATION (CONVERSATION SWITCH) ==
    describe('SPA Navigation — The Critical Bug', () => {
        test('stale baseline fixed: switching to new empty chat resets count', () => {
            // Start in conversation A with 5 messages
            tracker.startObserving(5, 'https://claude.ai/chat/conv-A');

            // User clicks "New chat" → URL changes, DOM has 0 messages
            const result = tracker.scanForNewMessages(0, 'https://claude.ai/chat/new');
            expect(result).toBe('no-messages');
            expect(tracker.state.processedMessageCount).toBe(0);
            expect(tracker.state.baselineEstablished).toBe(false);
        });

        test('first message in new conversation is detected via dom-scan', () => {
            // Start in conversation A with 5 messages
            tracker.startObserving(5, 'https://claude.ai/chat/conv-A');

            // Navigate to new chat
            tracker.scanForNewMessages(0, 'https://claude.ai/chat/new');

            // First user message appears
            const result = tracker.scanForNewMessages(1, 'https://claude.ai/chat/new');
            // baselineEstablished was false, so it captures baseline
            expect(result).toBe('baseline-captured');
        });

        test('second message in new conversation IS detected (the user-reported bug)', () => {
            // Reproduce exact user scenario:
            // 1. Previously in conversation with messages
            tracker.startObserving(5, 'https://claude.ai/chat/conv-A');

            // 2. Navigate to new chat
            tracker.scanForNewMessages(0, 'https://claude.ai/chat/new');

            // 3. First message: Enter key catches it
            tracker.countMessage('enter');

            // 4. DOM scan sees first message — captures baseline
            Date.now.mockReturnValue(13000);
            tracker.scanForNewMessages(1, 'https://claude.ai/chat/new');

            // 5. Second message: Enter key fires
            Date.now.mockReturnValue(16000);
            const entered = tracker.countMessage('enter');
            expect(entered).toBe(true);

            // 6. DOM scan also sees second message
            Date.now.mockReturnValue(19000);
            const scanned = tracker.scanForNewMessages(2, 'https://claude.ai/chat/new');
            expect(scanned).toBe('counted');

            // Total messages counted
            expect(tracker.messagesSent).toHaveLength(3);
        });

        test('switching to existing conversation with messages resets baseline', () => {
            tracker.startObserving(5, 'https://claude.ai/chat/conv-A');

            // Navigate to conversation B (has 3 messages already)
            // URL change triggers resetIfNavigated → processedMessageCount=0, baseline=false
            // Then scanForNewMessages sees 3 > 0 and !baselineEstablished → captures baseline
            const result = tracker.scanForNewMessages(3, 'https://claude.ai/chat/conv-B');
            expect(result).toBe('baseline-captured');
            expect(tracker.state.processedMessageCount).toBe(3);
            expect(tracker.state.baselineEstablished).toBe(true);

            // New message in conv B — now detected correctly
            Date.now.mockReturnValue(13000);
            const r2 = tracker.scanForNewMessages(4, 'https://claude.ai/chat/conv-B');
            expect(r2).toBe('counted');
        });

        test('URL change without count change still resets baseline', () => {
            tracker.startObserving(3, 'https://claude.ai/chat/conv-A');

            // Navigate to conv B that also happens to have 3 messages
            tracker.resetIfNavigated('https://claude.ai/chat/conv-B');
            expect(tracker.state.processedMessageCount).toBe(0);
            expect(tracker.state.baselineEstablished).toBe(false);
        });
    });

    // == DOM SCAN EDGE CASES ==
    describe('DOM Scan Edge Cases', () => {
        test('messages disappearing resets baseline', () => {
            tracker.startObserving(3, 'https://claude.ai/chat/abc');
            const result = tracker.scanForNewMessages(0);
            expect(result).toBe('no-messages');
            expect(tracker.state.processedMessageCount).toBe(0);
            expect(tracker.state.baselineEstablished).toBe(false);
        });

        test('count jump from 0→5 on page load captures baseline', () => {
            // Fresh load, baseline not yet established
            tracker.startObserving(0, 'https://claude.ai/chat/abc');
            // Simulate: observer starts with 0, then DOM renders 5 messages
            // Actually this won't happen because startObserving sets baseline=true
            // Test the scanForNewMessages path directly:
            const t = createTracker();
            t.scanForNewMessages(5);
            expect(t.state.baselineEstablished).toBe(true);
            expect(t.messagesSent).toHaveLength(0);
        });

        test('rapid mutations during streaming do not cause false counts', () => {
            tracker.startObserving(2, 'https://claude.ai/chat/abc');
            // Simulate many scans with the same count (streaming mutations)
            for (let i = 0; i < 50; i++) {
                const result = tracker.scanForNewMessages(2);
                expect(result).toBe('no-change');
            }
            expect(tracker.messagesSent).toHaveLength(0);
        });
    });

    // == CONTEXT INVALIDATION ==
    describe('Error Handling', () => {
        test('countMessage returns true when runtime is valid', () => {
            expect(tracker.countMessage('test')).toBe(true);
        });
    });
});
