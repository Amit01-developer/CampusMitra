// ===== COMMON THEME MANAGER — used by all pages =====
(function () {
    const DARK_KEY = 'darkMode';

    function applyTheme(dark) {
        // Apply ONLY on body — CSS variables are defined on body.dark-mode
        if (dark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        // Update ALL toggle buttons on the page — icon only
        document.querySelectorAll('.dark-toggle').forEach(function(btn) {
            btn.innerHTML = dark
                ? '<i class="fas fa-sun" aria-hidden="true"></i>'
                : '<i class="fas fa-moon" aria-hidden="true"></i>';
            btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
            btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        });
    }

    function toggleTheme() {
        var isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem(DARK_KEY, String(!isDark));
        applyTheme(!isDark);
    }

    function wireButtons() {
        document.querySelectorAll('.dark-toggle').forEach(function(btn) {
            // Use data attribute to avoid double-binding
            if (btn.dataset.themeWired) return;
            btn.dataset.themeWired = '1';
            btn.addEventListener('click', toggleTheme);
        });
    }

    // Apply saved theme immediately (before paint) — body may not exist yet
    // so we use a <style> tag on <html> to prevent flash
    var saved = localStorage.getItem(DARK_KEY) === 'true';
    if (saved) {
        // Inject a temporary style to prevent white flash
        var s = document.createElement('style');
        s.id = '__theme_preload';
        s.textContent = 'body{background:#0f0f1a!important;color:#e2e8f0!important}';
        document.head.appendChild(s);
    }

    // Wire up after DOM ready
    document.addEventListener('DOMContentLoaded', function () {
        // Remove preload style now that CSS vars are active
        var pre = document.getElementById('__theme_preload');
        if (pre) pre.remove();

        applyTheme(localStorage.getItem(DARK_KEY) === 'true');
        wireButtons();

        // Re-wire on any DOM mutation (for dynamically added buttons like auth modal)
        var observer = new MutationObserver(function() {
            wireButtons();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

    // Expose globally
    window.toggleTheme = toggleTheme;
    window.applyTheme  = applyTheme;
})();
