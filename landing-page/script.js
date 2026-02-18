/* ── Clear hash on load so URL stays clean ── */
if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname);
}

/* ── Navbar scroll effect (transparent → frosted glass) ── */
(function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    let ticking = false;
    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                if (window.scrollY > 50) {
                    navbar.classList.add('navbar--scrolled');
                } else {
                    navbar.classList.remove('navbar--scrolled');
                }
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial check
})();

/* ── Scroll indicator auto-hide ── */
(function initScrollIndicator() {
    const indicator = document.getElementById('scrollIndicator');
    const hero = document.getElementById('hero');
    if (!indicator || !hero) return;

    let ticking = false;
    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                const heroBottom = hero.offsetTop + hero.offsetHeight;
                if (window.scrollY > heroBottom * 0.3) {
                    indicator.classList.add('hidden');
                } else {
                    indicator.classList.remove('hidden');
                }
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
})();

/* ── Keyboard + typing text animation ── */
(function initKeyboardTyping() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const typingText = document.getElementById('heroTypingText');
    const typingCursor = document.getElementById('heroTypingCursor');
    const keys = document.querySelectorAll('#heroKeyboard .hero-key');
    if (!typingText || !keys.length) return;

    const PHRASE = 'Break limits with AI';
    const TYPE_SPEED = 120;       // ms per character typed
    const ERASE_SPEED = 60;       // ms per character erased
    const PAUSE_AFTER_TYPE = 2000; // pause after full phrase
    const PAUSE_AFTER_ERASE = 800; // pause before retyping

    // Build a lookup: character (uppercase) -> key element
    const keyMap = {};
    keys.forEach(key => {
        const char = key.getAttribute('data-char');
        if (char) keyMap[char.toUpperCase()] = key;
    });

    function pressKey(char) {
        const upper = char.toUpperCase();
        const keyEl = keyMap[upper];
        if (keyEl) {
            keyEl.classList.add('pressed');
            setTimeout(() => keyEl.classList.remove('pressed'), 300);
        }
    }

    if (reducedMotion) {
        // Show the full phrase immediately, no animation
        typingText.textContent = PHRASE;
        if (typingCursor) typingCursor.style.display = 'none';
        return;
    }

    let charIndex = 0;
    let isErasing = false;
    let timeoutId = null;

    function tick() {
        if (!isErasing) {
            // Typing forward
            if (charIndex < PHRASE.length) {
                const nextChar = PHRASE[charIndex];
                charIndex++;
                typingText.textContent = PHRASE.slice(0, charIndex);
                pressKey(nextChar);
                timeoutId = setTimeout(tick, TYPE_SPEED);
            } else {
                // Done typing — pause, then erase
                timeoutId = setTimeout(() => {
                    isErasing = true;
                    tick();
                }, PAUSE_AFTER_TYPE);
            }
        } else {
            // Erasing backward
            if (charIndex > 0) {
                charIndex--;
                typingText.textContent = PHRASE.slice(0, charIndex);
                timeoutId = setTimeout(tick, ERASE_SPEED);
            } else {
                // Done erasing — pause, then retype
                isErasing = false;
                timeoutId = setTimeout(tick, PAUSE_AFTER_ERASE);
            }
        }
    }

    // Start with a brief delay so hero content animates in first
    timeoutId = setTimeout(tick, 1200);

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearTimeout(timeoutId);
        } else {
            timeoutId = setTimeout(tick, 300);
        }
    });
})();

/* ── Scroll trail (left side) ── */
(function initScrollTrail() {
    const trail = document.getElementById('scrollTrail');
    if (!trail) return;

    const CELL_COUNT = 30;
    const cells = [];

    for (let i = 0; i < CELL_COUNT; i++) {
        const cell = document.createElement('div');
        cell.className = 'scroll-trail__cell';
        trail.appendChild(cell);
        cells.push(cell);
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
        cells.forEach(c => c.classList.add('lit-2'));
        return;
    }

    const TIERS = ['lit-1', 'lit-2', 'lit-3', 'lit-4'];

    function update() {
        const scrollY = window.scrollY || window.pageYOffset;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
        const target = Math.round(progress * CELL_COUNT);

        for (let i = 0; i < CELL_COUNT; i++) {
            // Remove all classes first
            cells[i].classList.remove(...TIERS, 'frontier');

            if (i < target) {
                // Distance from the leading edge (0 = right at edge, higher = further back)
                const distFromEdge = target - 1 - i;

                if (distFromEdge <= 1) {
                    cells[i].classList.add('lit-4');
                } else if (distFromEdge <= 4) {
                    cells[i].classList.add('lit-3');
                } else if (distFromEdge <= 10) {
                    cells[i].classList.add('lit-2');
                } else {
                    cells[i].classList.add('lit-1');
                }

                // Mark the very leading cell with a breathing pulse
                if (distFromEdge === 0) {
                    cells[i].classList.add('frontier');
                }
            }
        }
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
})();

/* ── Smooth scroll via data-scroll-to (no hash change) ── */
document.querySelectorAll('[data-scroll-to]').forEach((el) => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(el.dataset.scrollTo);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

/* ── Scroll reveal ── */
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
);
reveals.forEach((el) => observer.observe(el));

/* ── Scroll-driven contribution graph ── */
(function initScrollGraph() {
    const WEEKS = 26;
    const DAYS_PER_WEEK = 7;
    const TOTAL_CELLS = WEEKS * DAYS_PER_WEEK;
    const grid = document.getElementById('scrollGraphGrid');
    const monthsRow = document.getElementById('scrollGraphMonths');
    const counter = document.getElementById('scrollCommitCount');
    const section = document.getElementById('scroll-graph');
    if (!grid || !section) return;

    // Pre-assign a random intensity level (1-4) and contribution count for each cell
    const cellData = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
        const r = Math.random();
        let level, count;
        if (r < 0.35) { level = 1; count = Math.floor(Math.random() * 4) + 1; }
        else if (r < 0.6) { level = 2; count = Math.floor(Math.random() * 10) + 5; }
        else if (r < 0.82) { level = 3; count = Math.floor(Math.random() * 10) + 10; }
        else { level = 4; count = Math.floor(Math.random() * 15) + 20; }
        cellData.push({ level, count });
    }

    // Generate month labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    let lastMonth = -1;
    for (let w = 0; w < WEEKS; w++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (WEEKS - 1 - w) * 7);
        const m = d.getMonth();
        const span = document.createElement('span');
        span.className = 'scroll-graph__month';
        if (m !== lastMonth) {
            span.textContent = monthNames[m];
            lastMonth = m;
        }
        monthsRow.appendChild(span);
    }

    // Generate cells
    const cells = [];
    for (let i = 0; i < TOTAL_CELLS; i++) {
        const cell = document.createElement('div');
        cell.className = 'scroll-graph__cell';
        // Add a stagger delay per cell for a ripple effect
        const col = Math.floor(i / DAYS_PER_WEEK);
        const row = i % DAYS_PER_WEEK;
        const delay = (col * 0.015) + (row * 0.008);
        cell.style.transitionDelay = `${delay}s`;
        grid.appendChild(cell);
        cells.push(cell);
    }

    // Track how many cells are currently lit
    let litCount = 0;
    const isLit = new Array(TOTAL_CELLS).fill(false);

    // Reduced motion: show all immediately
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function updateOnScroll() {
        const rect = section.getBoundingClientRect();
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const scrollY = window.scrollY || window.pageYOffset;

        // Progress: 0 when section top reaches viewport, 1 when section bottom exits
        const start = sectionTop;
        const end = sectionTop + sectionHeight - window.innerHeight;
        let progress = (scrollY - start) / (end - start);
        progress = Math.max(0, Math.min(1, progress));

        const targetLit = Math.floor(progress * TOTAL_CELLS);
        let totalContribs = 0;

        for (let i = 0; i < TOTAL_CELLS; i++) {
            if (i < targetLit && !isLit[i]) {
                cells[i].classList.add(`lit-${cellData[i].level}`);
                isLit[i] = true;
            } else if (i >= targetLit && isLit[i]) {
                cells[i].classList.remove('lit-1', 'lit-2', 'lit-3', 'lit-4');
                isLit[i] = false;
            }
            if (isLit[i]) totalContribs += cellData[i].count;
        }

        counter.textContent = totalContribs.toLocaleString();
    }

    if (prefersReducedMotion) {
        // Show all cells immediately
        cells.forEach((cell, i) => {
            cell.classList.add(`lit-${cellData[i].level}`);
            isLit[i] = true;
        });
        let total = cellData.reduce((sum, d) => sum + d.count, 0);
        counter.textContent = total.toLocaleString();
    } else {
        window.addEventListener('scroll', updateOnScroll, { passive: true });
        updateOnScroll(); // initial call
    }
})();
