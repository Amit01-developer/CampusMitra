const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000/api'
    : 'https://campusmitra-bwi0.onrender.com/api';
let authToken = localStorage.getItem('cs_token');
let currentUser = null;
let allBrowseItems = [];

// ===== MOBILE SIDEBAR TOGGLE =====
function toggleDashSidebar() {
    const sidebar = document.querySelector('.dash-sidebar');
    const btn = document.getElementById('dashHamburger');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (btn) btn.classList.toggle('open');
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    c.appendChild(t);
    setTimeout(() => { t.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ===== DARK MODE — handled by theme.js =====
// theme.js is loaded in <head> and manages dark mode globally.
// initDarkMode() kept as no-op for backward compatibility.
function initDarkMode() { /* theme.js handles this */ }

// ===== AUTH CHECK =====
function requireAuth() {
    if (!authToken) {
        // Redirect to home with a flag so the login modal opens automatically
        window.location.href = 'index.html?login=1';
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('cs_token');
    window.location.href = 'index.html';
}

function authHeaders() {
    return { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
}

// ===== TAB SWITCHING =====
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabId}`)?.classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
    // Close mobile sidebar on tab switch
    document.querySelector('.dash-sidebar')?.classList.remove('open');
    document.getElementById('dashHamburger')?.classList.remove('open');
}

// ===== CONDITION CLASS =====
function condClass(c) {
    return c === 'Excellent' ? 'condition-excellent' : c === 'New' ? 'condition-new' : 'condition-good';
}

// ===== STATUS BADGE =====
function statusBadge(s) {
    const map = {
        pending:   ['#fffbeb','#92400e','Pending'],
        active:    ['#ecfdf5','#065f46','Active'],
        returned:  ['#eff6ff','#1e40af','Returned'],
        cancelled: ['#fee2e2','#dc2626','Cancelled'],
    };
    const [bg, color, label] = map[s] || ['#f3f4f6','#374151', s];
    return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:600">${label}</span>`;
}

// ===== CATEGORY GRADIENT =====
function catGradient(slug) {
    const map = {
        electronics: 'linear-gradient(135deg,#4f46e5,#6366f1)',
        textbooks:   'linear-gradient(135deg,#0d9488,#14b8a6)',
        tools:       'linear-gradient(135deg,#f59e0b,#d97706)',
        clothing:    'linear-gradient(135deg,#7c3aed,#8b5cf6)',
    };
    return map[slug] || 'linear-gradient(135deg,#6b7280,#9ca3af)';
}

function catIcon(slug) {
    const map = { electronics:'fa-laptop', textbooks:'fa-book', tools:'fa-tools', clothing:'fa-tshirt' };
    return map[slug] || 'fa-box';
}

// ============================================================
// =================== OWNER DASHBOARD ========================
// ============================================================
async function initOwnerDashboard() {
    if (!requireAuth()) return;
    initDarkMode();

    // Load user
    const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    if (!res.ok) { logout(); return; }
    currentUser = await res.json();

    document.getElementById('sidebarName').textContent = currentUser.name;
    document.getElementById('avatarInitial').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('dashUserName').textContent = currentUser.name.split(' ')[0];
    document.getElementById('ownerGreet').textContent = currentUser.name.split(' ')[0];

    // Sidebar nav
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchTab(link.dataset.tab);
            if (link.dataset.tab === 'my-items') loadOwnerItems();
            if (link.dataset.tab === 'requests') loadOwnerRequests();
        });
    });

    loadOwnerOverview();
}

async function loadOwnerOverview() {
    const [itemsRes, rentalsRes] = await Promise.all([
        fetch(`${API}/items?available=false`, { headers: authHeaders() }),
        fetch(`${API}/rentals?role=lender`, { headers: authHeaders() }),
    ]);
    const allItems = await itemsRes.json();
    const rentals = await rentalsRes.json();

    const myItems = allItems.filter(i => i.owner?.id === currentUser.id);
    const available = myItems.filter(i => i.is_available).length;
    const rented = myItems.filter(i => !i.is_available).length;
    const pending = rentals.filter(r => r.status === 'pending').length;

    document.getElementById('ovTotalItems').textContent = myItems.length;
    document.getElementById('ovAvailable').textContent = available;
    document.getElementById('ovRented').textContent = rented;
    document.getElementById('ovPending').textContent = pending;
    document.getElementById('reqBadge').textContent = pending;

    // Recent requests
    const container = document.getElementById('recentRequests');
    const recent = rentals.slice(0, 5);
    if (!recent.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No requests yet</p></div>'; return; }
    container.innerHTML = recent.map(r => renderRequestCard(r, true)).join('');
}

async function loadOwnerItems() {
    // available=false means "don't filter by availability" — get ALL items, then filter by owner
    const res = await fetch(`${API}/items?available=false`, { headers: authHeaders() });
    const allItems = await res.json();
    const myItems = Array.isArray(allItems) ? allItems.filter(i => i.owner?.id === currentUser.id) : [];
    const grid = document.getElementById('ownerItemsGrid');

    if (!myItems.length) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>No items listed yet. <a href="#" onclick="switchTab(\'add-item\')">Add one!</a></p></div>';
        return;
    }

    grid.innerHTML = myItems.map(item => `
        <div class="owner-item-card">
            <div class="owner-item-img" style="${item.image_url ? '' : 'background:' + catGradient(item.category_slug)}">
                ${item.image_url
                    ? `<img src="${item.image_url}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" />`
                    : `<i class="fas ${catIcon(item.category_slug)}"></i>`
                }
            </div>
            <div class="owner-item-body">
                <h3>${item.name}</h3>
                <div class="owner-item-meta">
                    <span class="owner-item-price">${item.price}</span>
                    <span class="status-pill ${item.is_available ? 'status-available' : 'status-rented'}">
                        ${item.is_available ? 'Available' : 'Rented'}
                    </span>
                </div>
                <p style="font-size:0.85rem;color:var(--gray);margin-bottom:12px">${item.description || ''}</p>
                <div class="owner-item-actions">
                    <button class="btn-sm-teal" onclick="toggleAvailability('${item.id}', ${item.is_available})">
                        <i class="fas fa-${item.is_available ? 'pause' : 'play'}"></i>
                        ${item.is_available ? 'Mark Rented' : 'Mark Available'}
                    </button>
                    <button class="btn-danger" onclick="deleteItem('${item.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

async function loadOwnerRequests() {
    const res = await fetch(`${API}/rentals?role=lender`, { headers: authHeaders() });
    const rentals = await res.json();
    const container = document.getElementById('allRequestsList');
    if (!rentals.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>No requests yet</p></div>'; return; }
    container.innerHTML = rentals.map(r => renderRequestCard(r, false)).join('');
}

function renderRequestCard(r, compact) {
    const item = r.item || {};
    const rid = String(r.id);
    const typeBadge = r.rental_type === 'borrow'
        ? '<span style="background:rgba(13,148,136,0.12);color:#0d9488;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">Borrow</span>'
        : '<span style="background:rgba(79,70,229,0.12);color:#4f46e5;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">Rent</span>';

    const actions = r.status === 'pending' ? `
        <button class="btn-accept" onclick="updateRentalStatus('${rid}','active')"><i class="fas fa-check"></i> Accept</button>
        <button class="btn-reject" onclick="updateRentalStatus('${rid}','cancelled')"><i class="fas fa-times"></i> Reject</button>
    ` : r.status === 'active' ? `
        <button class="btn-return" onclick="updateRentalStatus('${rid}','returned')"><i class="fas fa-undo"></i> Mark Returned</button>
    ` : statusBadge(r.status);

    return `
        <div class="request-card">
            <div class="request-info">
                <h4>${item.name || 'Item'} &nbsp;${typeBadge}</h4>
                <p>
                    <i class="fas fa-tag"></i> ${item.price || '—'} &nbsp;|&nbsp;
                    <i class="fas fa-calendar"></i> ${r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN') : '—'} → ${r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN') : '—'} &nbsp;|&nbsp;
                    <i class="fas fa-clock"></i> ${r.created_at ? r.created_at.split('T')[0] : '—'}
                </p>
            </div>
            <div class="request-actions">${actions}</div>
        </div>
    `;
}

async function toggleAvailability(itemId, currentlyAvailable) {
    await fetch(`${API}/items/${itemId}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ is_available: !currentlyAvailable })
    });
    showToast('Item status updated', 'success');
    loadOwnerItems();
}

async function deleteItem(itemId) {
    if (!confirm('Delete this item?')) return;
    const res = await fetch(`${API}/items/${itemId}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) { showToast('Item deleted', 'success'); loadOwnerItems(); }
    else showToast('Could not delete item', 'error');
}

async function submitNewItem() {
    const name          = document.getElementById('newItemName').value.trim();
    const category_slug = document.getElementById('newItemCategory').value;
    const price_amount  = parseFloat(document.getElementById('newItemPrice').value);
    const price_unit    = document.getElementById('newItemUnit').value;
    const deposit_amount= parseFloat(document.getElementById('newItemDeposit').value) || 0;
    const condition     = document.getElementById('newItemCondition').value;
    const description   = document.getElementById('newItemDesc').value.trim();

    if (!name || !category_slug || !price_amount) { showToast('Please fill required fields', 'error'); return; }

    // Convert image to base64 and store directly
    let image_url = '';
    const imgFile = document.getElementById('newItemImage').files[0];
    if (imgFile) {
        if (imgFile.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }
        showToast('Processing image...', 'info');
        image_url = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = e => resolve(e.target.result);
            reader.onerror = () => reject('Read error');
            reader.readAsDataURL(imgFile);
        });
    }

    const price   = `₹${price_amount}/${price_unit}`;
    const deposit = deposit_amount ? `₹${deposit_amount.toLocaleString('en-IN')}` : null;

    const res = await fetch(`${API}/items`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ name, category_slug, price, price_amount, price_unit, condition, description, deposit, deposit_amount, image_url })
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }

    showToast(`"${name}" listed successfully!`, 'success');
    document.getElementById('newItemName').value    = '';
    document.getElementById('newItemPrice').value   = '';
    document.getElementById('newItemDeposit').value = '';
    document.getElementById('newItemDesc').value    = '';
    removeImage();
    switchTab('my-items');
    loadOwnerItems();
}

// ===== IMAGE UPLOAD HELPERS =====
function previewImage(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imgPreview').src = e.target.result;
        document.getElementById('imgPreview').style.display = 'block';
        document.getElementById('imgPlaceholder').style.display = 'none';
        document.getElementById('imgRemoveBtn').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    document.getElementById('newItemImage').value   = '';
    document.getElementById('imgPreview').src       = '';
    document.getElementById('imgPreview').style.display     = 'none';
    document.getElementById('imgPlaceholder').style.display = 'flex';
    document.getElementById('imgRemoveBtn').style.display   = 'none';
}

async function updateRentalStatus(rentalId, status) {
    const res = await fetch(`${API}/rentals/${rentalId}/status`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
        showToast(data.error || 'Update failed', 'error'); return;
    }
    const label = { active:'accepted', cancelled:'rejected', returned:'marked as returned' }[status] || status;
    showToast(`Rental ${label}`, 'success');
    loadOwnerRequests();
    loadOwnerOverview();
}

// ============================================================
// ================== BORROWER DASHBOARD ======================
// ============================================================
async function initBorrowerDashboard() {
    if (!requireAuth()) return;
    initDarkMode();

    const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    if (!res.ok) { logout(); return; }
    currentUser = await res.json();

    document.getElementById('sidebarName').textContent = currentUser.name;
    document.getElementById('avatarInitial').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('dashUserName').textContent = currentUser.name.split(' ')[0];
    document.getElementById('borrowerGreet').textContent = currentUser.name.split(' ')[0];

    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchTab(link.dataset.tab);
            if (link.dataset.tab === 'browse') loadBrowseItems();
            if (link.dataset.tab === 'my-rentals') loadMyRentals();
        });
    });

    loadBorrowerOverview();
    loadBrowseItems();
}

async function loadBorrowerOverview() {
    const res = await fetch(`${API}/rentals?role=borrower`, { headers: authHeaders() });
    const rentals = await res.json();

    const total = rentals.length;
    const active = rentals.filter(r => r.status === 'active').length;
    const pending = rentals.filter(r => r.status === 'pending').length;
    const returned = rentals.filter(r => r.status === 'returned').length;

    document.getElementById('ovTotal').textContent = total;
    document.getElementById('ovActive').textContent = active;
    document.getElementById('ovPendingB').textContent = pending;
    document.getElementById('ovReturned').textContent = returned;
    document.getElementById('rentalBadge').textContent = active + pending;

    const container = document.getElementById('activeRentalsList');
    const activeRentals = rentals.filter(r => r.status === 'active' || r.status === 'pending');
    if (!activeRentals.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No active rentals</p></div>'; return; }
    container.innerHTML = activeRentals.map(r => renderBorrowerRentalCard(r)).join('');
}

async function loadBrowseItems() {
    const res = await fetch(`${API}/items`);
    allBrowseItems = await res.json();
    renderBrowseGrid(allBrowseItems);
}

function filterBrowse() {
    const q = document.getElementById('browseSearch').value.toLowerCase();
    const cat = document.getElementById('browseCategory').value;
    const cond = document.getElementById('browseCondition').value;

    const filtered = allBrowseItems.filter(item => {
        const matchQ = !q || item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
        const matchCat = !cat || item.category_slug === cat;
        const matchCond = !cond || item.condition === cond;
        return matchQ && matchCat && matchCond;
    });
    renderBrowseGrid(filtered);
}

function renderBrowseGrid(items) {
    const grid = document.getElementById('browseGrid');
    if (!items.length) { grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No items found</p></div>'; return; }

    grid.innerHTML = items.map(item => `
        <div class="browse-card">
            <div class="browse-card-img" style="${item.image_url ? '' : 'background:' + catGradient(item.category_slug)}">
                ${item.image_url
                    ? `<img src="${item.image_url}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover" />`
                    : `<i class="fas ${catIcon(item.category_slug)}"></i>`
                }
            </div>
            <div class="browse-card-body">
                <h3>${item.name}</h3>
                <p>${item.description || ''}</p>
                <div class="browse-price">${item.price}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <span class="item-condition ${condClass(item.condition)}">${item.condition}</span>
                    <span style="font-size:0.82rem;color:var(--gray)"><i class="fas fa-user"></i> ${item.owner?.name || '—'}</span>
                </div>
                <button class="btn btn-primary" style="width:100%;padding:9px;font-size:0.9rem;margin-bottom:6px"
                    onclick="requestRental('${item.id}', '${item.name.replace(/'/g,"\\'")}', '${item.price}', 'rent')">
                    <i class="fas fa-shopping-cart"></i> Rent Now
                </button>
                <button class="btn btn-secondary" style="width:100%;padding:9px;font-size:0.9rem;background:linear-gradient(135deg,var(--secondary),var(--secondary-dark));color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;transition:opacity .2s"
                    onclick="requestRental('${item.id}', '${item.name.replace(/'/g,"\\'")}', '${item.price}', 'borrow')">
                    <i class="fas fa-handshake"></i> Borrow Free
                </button>
            </div>
        </div>
    `).join('');
}

async function requestRental(itemId, itemName, itemPrice, rentalType) {
    if (!authToken) { showToast('Please log in first', 'error'); return; }
    const res = await fetch(`${API}/items/${itemId}`);
    const item = await res.json();
    if (item.error) { showToast(item.error, 'error'); return; }

    const p = new URLSearchParams({
        item_id:        item.id,
        name:           item.name,
        price:          item.price,
        price_amount:   item.price_amount  || 0,
        price_unit:     item.price_unit    || 'day',
        condition:      item.condition     || 'Good',
        deposit:        item.deposit       || '—',
        deposit_amount: item.deposit_amount|| 0,
        owner:          item.owner?.name   || '—',
        category:       item.category_slug || 'electronics',
        rental_type:    rentalType || 'rent',
        description:    item.description   || '',
    });
    window.location.href = 'payment.html?' + p.toString();
}

async function loadMyRentals() {
    const res = await fetch(`${API}/rentals?role=borrower`, { headers: authHeaders() });
    const rentals = await res.json();
    const container = document.getElementById('allRentalsList');
    if (!rentals.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>No rentals yet</p></div>'; return; }
    container.innerHTML = rentals.map(r => renderBorrowerRentalCard(r)).join('');
}

function renderBorrowerRentalCard(r) {
    const item = r.item || {};
    const rid = String(r.id);
    const typeBadge = r.rental_type === 'borrow'
        ? '<span style="background:rgba(13,148,136,0.12);color:#0d9488;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">Borrow</span>'
        : '<span style="background:rgba(79,70,229,0.12);color:#4f46e5;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">Rent</span>';

    const actions = r.status === 'pending'
        ? `<button class="btn-reject" onclick="cancelMyRental('${rid}')"><i class="fas fa-times"></i> Cancel</button>`
        : r.status === 'active'
        ? `<button class="btn-return" onclick="cancelMyRental('${rid}')"><i class="fas fa-undo"></i> Return Item</button>`
        : statusBadge(r.status);

    return `
        <div class="request-card">
            <div class="request-info">
                <h4>${item.name || 'Item'} &nbsp;${typeBadge}</h4>
                <p>
                    <i class="fas fa-tag"></i> ${item.price || '—'} &nbsp;|&nbsp;
                    <i class="fas fa-calendar"></i> ${r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN') : '—'} → ${r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN') : '—'} &nbsp;|&nbsp;
                    <i class="fas fa-rupee-sign"></i> ${r.total_price ? '₹' + Number(r.total_price).toLocaleString('en-IN') : 'Free'}
                </p>
            </div>
            <div class="request-actions">${actions}</div>
        </div>
    `;
}

async function cancelMyRental(rentalId) {
    const status = 'cancelled';
    const res = await fetch(`${API}/rentals/${rentalId}/status`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok || data.error) { showToast(data.error || 'Failed', 'error'); return; }
    showToast('Rental cancelled', 'info');
    loadMyRentals();
    loadBorrowerOverview();
}

// ===== ENTRY POINT =====
function initDashboard(role) {
    if (role === 'owner') initOwnerDashboard();
    else initBorrowerDashboard();
}

// ===== GOOGLE LOGIN CALLBACK (used by firebase-auth.js) =====
// On dashboards, Google login reloads the page so initDashboard picks up the new token.
window._googleLoginSuccess = function (data) {
    // token already saved to localStorage by firebase-auth.js
    authToken   = data.token;
    currentUser = data.user;
    // Reload to re-run initDashboard with the fresh token
    window.location.reload();
};
