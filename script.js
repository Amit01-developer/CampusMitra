// ===== CONFIG =====
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000/api'
    : 'https://campusmitra-bwi0.onrender.com/api';

// ===== AUTH STATE =====
let currentUser = null;
let authToken = localStorage.getItem('cs_token') || null;

function authHeaders() {
    return authToken ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ===== TOAST SYSTEM =====
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="dismissToast(this.parentElement)"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
}

// ===== DARK MODE =====
function initDarkMode() {
    const toggle = document.getElementById('darkToggle');
    if (localStorage.getItem('darkMode') === 'true') enableDark();
    toggle.addEventListener('click', () =>
        document.body.classList.contains('dark-mode') ? disableDark() : enableDark()
    );
}

function enableDark() {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
    document.getElementById('darkToggle').innerHTML = '<i class="fas fa-sun"></i> Light';
}

function disableDark() {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
    document.getElementById('darkToggle').innerHTML = '<i class="fas fa-moon"></i> Dark';
}

// ===== HAMBURGER =====
function initHamburger() {
    const btn = document.getElementById('hamburger');
    const nav = document.getElementById('mobileNav');
    btn.addEventListener('click', () => { btn.classList.toggle('open'); nav.classList.toggle('open'); });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        btn.classList.remove('open'); nav.classList.remove('open');
    }));
}

// ===== SCROLL TO TOP =====
function initScrollTop() {
    const btn = document.getElementById('scrollTop');
    window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400));
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== HERO SEARCH =====
function handleSearch() {
    const query = document.getElementById('heroSearch').value.trim();
    if (!query) { showToast('Please enter something to search', 'error'); return; }

    fetch(`${API}/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(items => {
            if (items.length === 0) {
                showToast(`No items found for "${query}"`, 'error');
                return;
            }
            // If all results belong to one category, open that category page
            const slugs = [...new Set(items.map(i => i.category_slug))];
            if (slugs.length === 1) {
                showToast(`Found ${items.length} result(s) for "${query}"`, 'success');
                setTimeout(() => showCategoryPage(slugs[0]), 400);
            } else {
                showToast(`Found ${items.length} result(s) — showing Browse Items`, 'success');
                document.getElementById('items').scrollIntoView({ behavior: 'smooth' });
            }
        })
        .catch(() => showToast('Search failed. Is the server running?', 'error'));
}

// ===== ANIMATED STATS COUNTER =====
function animateCounter(el, target) {
    const num = parseInt(String(target).replace(/[^0-9]/g, ''));
    if (isNaN(num)) { el.textContent = target; return; }
    const prefix = String(target).includes('₹') ? '₹' : '';
    const suffix = String(target).includes('+') ? '+' : String(target).includes('%') ? '%' : '';
    let start = 0;
    const step = Math.ceil(num / 80);
    const timer = setInterval(() => {
        start = Math.min(start + step, num);
        el.textContent = prefix + start.toLocaleString('en-IN') + suffix;
        if (start >= num) clearInterval(timer);
    }, 16);
}

function initStatsAnimation() {
    const statEls = document.querySelectorAll('.stat-item h3');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                animateCounter(entry.target, entry.target.textContent);
            }
        });
    }, { threshold: 0.5 });
    statEls.forEach(el => observer.observe(el));
}

// ===== LOAD LIVE STATS FROM API =====
function loadStats() {
    fetch(`${API}/stats`)
        .then(r => r.json())
        .then(data => {
            const els = document.querySelectorAll('.stat-item h3');
            if (els[0]) els[0].textContent = data.total_items + '+';
            if (els[1]) els[1].textContent = '₹' + (data.savings / 1000).toFixed(0) + 'K+';
            if (els[2]) els[2].textContent = data.total_users + '+';
            if (els[3]) els[3].textContent = data.satisfaction + '%';
        })
        .catch(() => {}); // silently fall back to hardcoded values
}

// ===== SHOW CATEGORY PAGE (from API) =====
let _currentCategorySlug = '';

function showCategoryPage(slug) {
    _currentCategorySlug = slug;
    document.getElementById('mainPage').style.display = 'none';
    document.getElementById('rentalsDashboard').style.display = 'none';
    document.getElementById('categoryPage').style.display = 'block';
    document.getElementById('categoryTitle').textContent = 'Loading...';
    document.getElementById('categoryDescription').textContent = '';
    document.getElementById('categoryStats').innerHTML = '';
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';
    document.getElementById('filterCondition').value = '';
    loadCategoryItems(slug);
    window.scrollTo(0, 0);
}

function buildCategoryUrl(slug) {
    const min = document.getElementById('filterMinPrice').value;
    const max = document.getElementById('filterMaxPrice').value;
    const cond = document.getElementById('filterCondition').value;
    let url = `${API}/categories/${slug}`;
    const params = [];
    if (min) params.push(`min_price=${encodeURIComponent(min)}`);
    if (max) params.push(`max_price=${encodeURIComponent(max)}`);
    if (cond) params.push(`condition=${encodeURIComponent(cond)}`);
    if (params.length) url += '?' + params.join('&');
    return url;
}

function applyFilters() {
    if (_currentCategorySlug) loadCategoryItems(_currentCategorySlug);
}

function resetFilters() {
    document.getElementById('filterMinPrice').value = '';
    document.getElementById('filterMaxPrice').value = '';
    document.getElementById('filterCondition').value = '';
    if (_currentCategorySlug) loadCategoryItems(_currentCategorySlug);
}

function loadCategoryItems(slug) {
    document.getElementById('itemsTableBody').innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray)"><i class="fas fa-spinner fa-spin"></i> Loading items...</td></tr>';

    fetch(buildCategoryUrl(slug))
        .then(r => r.json())
        .then(data => {
            document.getElementById('categoryTitle').textContent = data.name;
            document.getElementById('categoryDescription').textContent = data.description;
            document.getElementById('categoryStats').innerHTML = `
                <div class="stat-box"><div class="stat-value">${data.stats.totalItems}</div><div class="stat-label">Items Available</div></div>
                <div class="stat-box"><div class="stat-value">${data.stats.avgPrice}</div><div class="stat-label">Average Rental Price</div></div>
                <div class="stat-box"><div class="stat-value">${data.stats.availability}</div><div class="stat-label">Availability</div></div>
            `;
            const tbody = document.getElementById('itemsTableBody');
            tbody.innerHTML = '';
            if (!data.items || data.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray)">No items match your filters.</td></tr>';
                return;
            }
            data.items.forEach(item => {
                const condClass = item.condition.toLowerCase() === 'excellent' ? 'condition-excellent'
                    : item.condition.toLowerCase() === 'new' ? 'condition-new' : 'condition-good';
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="item-name">${item.name}</td>
                    <td style="font-weight:700;color:var(--primary)">${item.price}</td>
                    <td><span class="item-condition ${condClass}">${item.condition}</span></td>
                    <td>${item.description || ''}</td>
                    <td>${item.deposit || '—'}</td>
                    <td><button class="rent-button" onclick="rentItem('${item.id}', '${item.name.replace(/'/g, "\\'")}', '${item.price}')"><i class="fas fa-shopping-cart"></i> Rent Now</button></td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(() => {
            document.getElementById('itemsTableBody').innerHTML =
                '<tr><td colspan="6" style="text-align:center;padding:30px;color:#f44336"><i class="fas fa-exclamation-circle"></i> Failed to load. Is the server running?</td></tr>';
        });
}

// ===== GO BACK =====
function goBackToMain() {
    document.getElementById('mainPage').style.display = 'block';
    document.getElementById('categoryPage').style.display = 'none';
    document.getElementById('rentalsDashboard').style.display = 'none';
    window.scrollTo(0, 0);
}

// ===== MY RENTALS DASHBOARD =====
let _rentalsRole = 'borrower';

function openRentalsDashboard() {
    if (!authToken) { showToast('Please log in first', 'error'); openAuthModal('login'); return; }
    document.getElementById('mainPage').style.display = 'none';
    document.getElementById('categoryPage').style.display = 'none';
    document.getElementById('rentalsDashboard').style.display = 'block';
    _rentalsRole = 'borrower';
    document.querySelectorAll('.rentals-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    loadRentals('borrower');
    window.scrollTo(0, 0);
}

function closeRentalsDashboard() {
    document.getElementById('rentalsDashboard').style.display = 'none';
    document.getElementById('mainPage').style.display = 'block';
    window.scrollTo(0, 0);
}

function switchRentalsTab(role) {
    _rentalsRole = role;
    document.querySelectorAll('.rentals-tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (role === 'borrower')));
    loadRentals(role);
}

function loadRentals(role) {
    const content = document.getElementById('rentalsContent');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray)"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    fetch(`${API}/rentals?role=${role}`, { headers: authHeaders() })
        .then(r => r.json())
        .then(rentals => {
            if (!rentals.length) {
                content.innerHTML = `<div class="rentals-empty"><i class="fas fa-box-open fa-3x"></i><p>No ${role === 'borrower' ? 'borrowed' : 'lent'} items yet.</p></div>`;
                return;
            }
            const statusColors = { pending: '#f59e0b', active: '#10b981', returned: '#6b7280', cancelled: '#ef4444' };
            content.innerHTML = rentals.map(r => `
                <div class="rental-card">
                    <div class="rental-card-header">
                        <span class="rental-item-name">${r.item?.name || 'Unknown Item'}</span>
                        <span class="rental-status" style="background:${statusColors[r.status] || '#6b7280'}20;color:${statusColors[r.status] || '#6b7280'};border:1px solid ${statusColors[r.status] || '#6b7280'}40">
                            ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                    </div>
                    <div class="rental-card-body">
                        <div class="rental-detail"><i class="fas fa-tag"></i> ${r.item?.price || '—'}</div>
                        <div class="rental-detail"><i class="fas fa-calendar-alt"></i> ${r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN') : '—'} → ${r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN') : '—'}</div>
                        <div class="rental-detail"><i class="fas fa-rupee-sign"></i> Total: ${r.total_price ? '₹' + r.total_price : '—'}</div>
                        <div class="rental-detail"><i class="fas fa-clock"></i> Requested: ${new Date(r.created_at).toLocaleDateString('en-IN')}</div>
                    </div>
                    ${r.status === 'active' && role === 'borrower' ? `
                    <div class="rental-card-actions">
                        <button class="btn btn-outline btn-small" onclick="updateRentalStatus(${r.id}, 'returned')"><i class="fas fa-undo"></i> Mark Returned</button>
                    </div>` : ''}
                    ${r.status === 'pending' && role === 'lender' ? `
                    <div class="rental-card-actions">
                        <button class="btn btn-primary btn-small" onclick="updateRentalStatus(${r.id}, 'active')"><i class="fas fa-check"></i> Approve</button>
                        <button class="btn btn-outline btn-small" onclick="updateRentalStatus(${r.id}, 'cancelled')"><i class="fas fa-times"></i> Decline</button>
                    </div>` : ''}
                </div>
            `).join('');
        })
        .catch(() => {
            content.innerHTML = '<div class="rentals-empty"><i class="fas fa-exclamation-circle fa-2x"></i><p>Failed to load rentals.</p></div>';
        });
}

function updateRentalStatus(rentalId, status) {
    fetch(`${API}/rentals/${rentalId}/status`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ status })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { showToast(data.error, 'error'); return; }
        showToast(`Rental marked as ${status}`, 'success');
        loadRentals(_rentalsRole);
    })
    .catch(() => showToast('Update failed', 'error'));
}

// ===== RENT ITEM =====
function rentItem(itemId, itemName, itemPrice) {
    if (!authToken) {
        showToast('Please log in to rent items', 'error');
        openAuthModal('login');
        return;
    }
    fetch(`${API}/rentals`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ item_id: itemId, rental_type: 'rent' })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { showToast(data.error, 'error'); return; }
        showToast(`"${itemName}" rented successfully! (${itemPrice})`, 'success');
    })
    .catch(() => showToast('Rental request failed', 'error'));
}

// ===== GOOGLE LOGIN CALLBACK =====
window._googleLoginSuccess = function(data) {
    authToken = data.token;
    currentUser = data.user;
    closeAuthModal();
    updateAuthUI();
    showToast(`Welcome, ${data.user.name}!`, 'success');
};

// ===== AUTH MODAL =====
function openAuthModal(mode = 'login') {
    let modal = document.getElementById('authModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'authModal';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-box">
            <button class="modal-close" onclick="closeAuthModal()"><i class="fas fa-times"></i></button>
            <div class="modal-tabs">
                <button class="modal-tab ${mode === 'login' ? 'active' : ''}" onclick="switchTab('login')">Log In</button>
                <button class="modal-tab ${mode === 'signup' ? 'active' : ''}" onclick="switchTab('signup')">Sign Up</button>
            </div>
            <div id="loginForm" style="display:${mode === 'login' ? 'block' : 'none'}">
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="loginEmail" placeholder="your@campus.edu" />
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" placeholder="••••••••" />
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="doLogin()">Log In</button>
                <div class="google-divider"><span>or</span></div>
                <button class="btn-google" onclick="window.signInWithGoogle()">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="Google" />
                    Continue with Google
                </button>
            </div>
            <div id="signupForm" style="display:${mode === 'signup' ? 'block' : 'none'}">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="signupName" placeholder="Your name" />
                </div>
                <div class="form-group">
                    <label>Campus Email</label>
                    <input type="email" id="signupEmail" placeholder="your@campus.edu" />
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="signupPassword" placeholder="••••••••" />
                </div>
                <div class="form-group">
                    <label>Department</label>
                    <input type="text" id="signupDept" placeholder="e.g. Computer Science" />
                </div>
                <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="doSignup()">Create Account</button>
                <div class="google-divider"><span>or</span></div>
                <button class="btn-google" onclick="window.signInWithGoogle()">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" height="20" alt="Google" />
                    Continue with Google
                </button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

function switchTab(mode) {
    document.getElementById('loginForm').style.display = mode === 'login' ? 'block' : 'none';
    document.getElementById('signupForm').style.display = mode === 'signup' ? 'block' : 'none';
    document.querySelectorAll('.modal-tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (mode === 'login')));
}

function doLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { showToast(data.error, 'error'); return; }
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('cs_token', authToken);
        closeAuthModal();
        updateAuthUI();
        showToast(`Welcome back, ${data.user.name}!`, 'success');
    })
    .catch(() => showToast('Login failed', 'error'));
}

function doSignup() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const department = document.getElementById('signupDept').value;
    fetch(`${API}/auth/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, department })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { showToast(data.error, 'error'); return; }
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('cs_token', authToken);
        closeAuthModal();
        updateAuthUI();
        showToast(`Welcome to CampusMitra, ${data.user.name}!`, 'success');
    })
    .catch(() => showToast('Signup failed', 'error'));
}

function doLogout() {
    authToken = null; currentUser = null;
    localStorage.removeItem('cs_token');
    updateAuthUI();
    // Reset hero buttons to require login again
    const borrowBtn = document.getElementById('heroBorrowBtn');
    const listBtn = document.getElementById('heroListBtn');
    if (borrowBtn) borrowBtn.href = 'borrower-dashboard.html';
    if (listBtn) listBtn.href = 'owner-dashboard.html';
    showToast('Logged out successfully', 'info');
}

function updateAuthUI() {
    const authDiv = document.querySelector('.auth-buttons');
    const darkBtn = document.getElementById('darkToggle');
    const dashDropdown = document.getElementById('dashDropdown');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');

    if (currentUser) {
        // Show dashboard dropdown
        if (dashDropdown) dashDropdown.style.display = 'flex';
        if (loginBtn) { loginBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${currentUser.name.split(' ')[0]}`; loginBtn.onclick = null; loginBtn.style.cursor = 'default'; loginBtn.title = currentUser.name; }
        if (signupBtn) { signupBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout'; signupBtn.onclick = doLogout; }

        // My Rentals button
        let rentalsBtn = document.getElementById('myRentalsBtn');
        if (!rentalsBtn && authDiv) {
            rentalsBtn = document.createElement('button');
            rentalsBtn.id = 'myRentalsBtn';
            rentalsBtn.className = 'btn btn-outline';
            rentalsBtn.innerHTML = '<i class="fas fa-list"></i> Rentals';
            rentalsBtn.onclick = openRentalsDashboard;
            authDiv.insertBefore(rentalsBtn, signupBtn);
        }

        // Mobile nav dashboard links
        const mo = document.getElementById('mobileOwnerLink');
        const mb = document.getElementById('mobileBorrowerLink');
        if (mo) mo.style.display = 'block';
        if (mb) mb.style.display = 'block';
    } else {
        if (dashDropdown) dashDropdown.style.display = 'none';
        if (loginBtn) { loginBtn.innerHTML = 'Log In'; loginBtn.onclick = () => openAuthModal('login'); loginBtn.style.cursor = 'pointer'; }
        if (signupBtn) { signupBtn.innerHTML = 'Sign Up Free'; signupBtn.onclick = () => openAuthModal('signup'); }

        // Remove My Rentals button if present
        document.getElementById('myRentalsBtn')?.remove();

        const mo = document.getElementById('mobileOwnerLink');
        const mb = document.getElementById('mobileBorrowerLink');
        if (mo) mo.style.display = 'none';
        if (mb) mb.style.display = 'none';
    }

    // Re-bind dark toggle after innerHTML changes
    const dt = document.getElementById('darkToggle');
    if (dt) {
        dt.onclick = () => document.body.classList.contains('dark-mode') ? disableDark() : enableDark();
        if (localStorage.getItem('darkMode') === 'true') enableDark();
    }
}

// ===== SCROLL ANIMATIONS =====
function setupAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    const animate = (selector, delay = 0) => {
        document.querySelectorAll(selector).forEach((el, i) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(25px)';
            el.style.transition = `opacity 0.5s ease ${delay + i * 0.1}s, transform 0.5s ease ${delay + i * 0.1}s`;
            observer.observe(el);
        });
    };

    animate('.step');
    animate('.category-card', 0.1);
    animate('.item-card', 0.05);
    animate('.ai-feature-card', 0.15);
}

// ===== SMOOTH SCROLLING =====
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;
            e.preventDefault();
            const target = document.querySelector(targetId);
            if (!target) return;
            if (document.getElementById('categoryPage').style.display === 'block') {
                goBackToMain();
                setTimeout(() => window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' }), 150);
            } else {
                window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
            }
        });
    });
}

// ===== ITEM CARD BUTTONS (main page) =====
function setupButtonEvents() {
    document.querySelectorAll('.btn-rent, .btn-borrow').forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();
            if (!authToken) { showToast('Please log in first', 'error'); openAuthModal('login'); return; }
            const itemName = this.closest('.item-card')?.querySelector('h3')?.textContent || 'Item';
            showToast(`Request for "${itemName}" sent!`, 'success');
        });
    });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function () {
    initDarkMode();
    initHamburger();
    initScrollTop();
    initStatsAnimation();
    setupAnimations();
    setupSmoothScrolling();
    setupButtonEvents();
    loadStats();

    // Hero CTA buttons — require login
    document.getElementById('heroBorrowBtn')?.addEventListener('click', function(e) {
        if (!authToken) { e.preventDefault(); showToast('Please log in first', 'error'); openAuthModal('login'); }
    });
    document.getElementById('heroListBtn')?.addEventListener('click', function(e) {
        if (!authToken) { e.preventDefault(); showToast('Please log in first', 'error'); openAuthModal('login'); }
    });

    // Restore session
    if (authToken) {
        fetch(`${API}/auth/me`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : null)
            .then(user => { if (user) { currentUser = user; updateAuthUI(); } })
            .catch(() => {});
    }

    // Wire up header buttons
    document.getElementById('loginBtn')?.addEventListener('click', () => openAuthModal('login'));
    document.getElementById('signupBtn')?.addEventListener('click', () => openAuthModal('signup'));

    // Dashboard dropdown toggle
    const dropBtn = document.getElementById('dashDropdownBtn');
    const dropMenu = document.getElementById('dashDropdownMenu');
    if (dropBtn && dropMenu) {
        dropBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropMenu.classList.toggle('open');
        });
        document.addEventListener('click', () => dropMenu.classList.remove('open'));
    }

    // Search on Enter
    document.getElementById('heroSearch')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleSearch();
    });

    // Close modal on overlay click
    document.addEventListener('click', e => {
        if (e.target.id === 'authModal') closeAuthModal();
    });
});
