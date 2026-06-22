/**
 * BGrade Global Navbar
 * Injects the shared navbar, handles: Tool Dropdown, Live Search, Theme Toggle, Scroll-Shrink.
 */
(function () {
    // ─── Detect root path ─────────────────────────────────────────────
    const scripts = document.getElementsByTagName('script');
    let rootPath = '/';
    for (let s of scripts) {
        if (s.src && s.src.includes('global-nav.js')) {
            const url = new URL(s.src);
            rootPath = url.pathname.replace('global-nav.js', '');
            break;
        }
    }

    const TOOLS = [
        {
            label: 'AI Passport Photo Maker',
            desc: 'Biometric AI background removal',
            icon: 'ph ph-identification-badge',
            href: rootPath + 'passport_photo_maker/'
        },
        {
            label: 'Pro File Converter',
            desc: 'Convert & resize images + PDF',
            icon: 'ph ph-file-arrow-up',
            href: rootPath + 'file_converter/'
        },
        {
            label: 'Pro ID Card Printer',
            desc: 'A4 & PVC CR80 ID layout tool',
            icon: 'ph ph-printer',
            href: rootPath + 'id_card_printer/'
        },
    ];

    // ─── Build Navbar HTML ─────────────────────────────────────────────
    function buildToolItems() {
        return TOOLS.map(t => `
            <a href="${t.href}" class="tool-item">
                <i class="${t.icon}"></i>
                <div>
                    <strong>${t.label}</strong>
                    <p>${t.desc}</p>
                </div>
            </a>`).join('');
    }

    const navbarHtml = `
    <nav class="global-navbar" id="global-navbar">
        <div class="nav-left">
            <a href="${rootPath}" class="nav-logo">
                <div class="logo-icon">B</div>
                <span class="logo-text">B-<span>Grade</span></span>
            </a>
            <div class="nav-tools-trigger" id="tools-trigger">
                <i class="ph ph-grid-four nav-icon"></i>
                <span>All Tools</span>
                <i class="ph ph-caret-down" id="tools-caret"></i>
                <div class="tools-dropdown" id="tools-dropdown">
                    ${buildToolItems()}
                </div>
            </div>
        </div>

        <div class="nav-center">
            <div class="nav-search-wrapper">
                <i class="ph ph-magnifying-glass search-icon"></i>
                <input type="text" class="nav-search" id="nav-search" placeholder="Search tools…" autocomplete="off">
                <div class="search-results" id="search-results"></div>
            </div>
        </div>

        <div class="nav-right">
            <button class="theme-toggle" id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
                <i class="ph ph-moon" id="theme-icon"></i>
            </button>
            <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Menu">
                <i class="ph ph-list"></i>
            </button>
        </div>
    </nav>`;

    // ─── Inject Navbar ─────────────────────────────────────────────────
    const container = document.getElementById('global-navbar-container');
    if (container) container.innerHTML = navbarHtml;

    // ─── Theme Logic ───────────────────────────────────────────────────
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('bgrade-theme') || 'light';
    html.setAttribute('data-theme', savedTheme);

    function updateThemeIcon() {
        const icon = document.getElementById('theme-icon');
        if (!icon) return;
        const isDark = html.getAttribute('data-theme') === 'dark';
        icon.className = isDark ? 'ph ph-sun' : 'ph ph-moon';
    }
    updateThemeIcon();

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('bgrade-theme', next);
        updateThemeIcon();
    });

    // ─── Scroll Shrink ─────────────────────────────────────────────────
    const navbar = document.getElementById('global-navbar');
    window.addEventListener('scroll', () => {
        if (!navbar) return;
        navbar.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    // ─── Tools Dropdown ────────────────────────────────────────────────
    const trigger = document.getElementById('tools-trigger');
    trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        trigger.classList.toggle('open');
    });
    document.addEventListener('click', () => {
        trigger?.classList.remove('open');
    });

    // ─── Live Search ───────────────────────────────────────────────────
    const searchInput = document.getElementById('nav-search');
    const searchResults = document.getElementById('search-results');

    searchInput?.addEventListener('input', () => {
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
            searchResults?.classList.remove('visible');
            return;
        }
        const matches = TOOLS.filter(t =>
            t.label.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
        );
        if (matches.length === 0) {
            searchResults.innerHTML = `<div class="search-empty">No tools found</div>`;
        } else {
            searchResults.innerHTML = matches.map(t => `
                <a href="${t.href}" class="search-result-item">
                    <i class="${t.icon}"></i>
                    <span>${t.label}</span>
                </a>`).join('');
        }
        searchResults?.classList.add('visible');
    });

    document.addEventListener('click', (e) => {
        if (!searchInput?.contains(e.target) && !searchResults?.contains(e.target)) {
            searchResults?.classList.remove('visible');
        }
    });

    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchResults?.classList.remove('visible');
            searchInput.blur();
        }
    });
})();
