/* ─────────────────────────────────────────────────────────────
   CRIS Document Portal — client-side app
   All data lives in the browser:
     - Files       → IndexedDB (object store 'files')
     - Session     → localStorage 'cris_session'
     - Activity    → localStorage 'cris_activity'
     - Captcha     → sessionStorage 'cris_captcha'
     - Flash msgs  → sessionStorage 'cris_flash'
   ───────────────────────────────────────────────────────────── */

// ────────────────────────────────────────────
// Mock user directory
// ────────────────────────────────────────────
const USERS = {
    admin: {
        password: 'cris123',
        name: 'Shivansh Sharma',
        role: 'Admin',
        designation: 'Software Intern · Delhi Division',
        employee_id: 'CRIS/INT/2026/045',
    },
    viewer: {
        password: 'viewer123',
        name: 'Anita Verma',
        role: 'Viewer',
        designation: 'Section Officer · Records',
        employee_id: 'CRIS/SO/2024/119',
    },
};

const MAX_FILE_SIZE_MB = 16;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'rtf', 'odt',
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg',
    'zip', 'rar', '7z',
]);

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getExtension(filename) {
    const i = filename.lastIndexOf('.');
    return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

function isAllowed(filename) {
    return ALLOWED_EXTENSIONS.has(getExtension(filename));
}

function getFileCategory(ext) {
    ext = (ext || '').toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', icon: 'icon-pdf' };
    if (['doc','docx','odt','rtf'].includes(ext)) return { label: 'DOC', icon: 'icon-doc' };
    if (['xls','xlsx','csv'].includes(ext))       return { label: 'XLS', icon: 'icon-xls' };
    if (['ppt','pptx'].includes(ext))             return { label: 'PPT', icon: 'icon-ppt' };
    if (['png','jpg','jpeg','gif','bmp','webp','svg'].includes(ext)) return { label: 'IMG', icon: 'icon-img' };
    if (['zip','rar','7z'].includes(ext))         return { label: 'ZIP', icon: 'icon-zip' };
    if (ext === 'txt') return { label: 'TXT', icon: 'icon-txt' };
    return { label: ext.toUpperCase() || 'FILE', icon: 'icon-generic' };
}

function isPreviewable(ext) {
    return ['pdf','png','jpg','jpeg','gif','bmp','webp','svg','txt'].includes((ext || '').toLowerCase());
}

function formatDate(date) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = months[date.getMonth()];
    const yy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mn = String(date.getMinutes()).padStart(2, '0');
    return `${dd} ${mm} ${yy}, ${hh}:${mn}`;
}

function formatDateTime(date) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = months[date.getMonth()];
    const yy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mn = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${dd} ${mm} ${yy}, ${hh}:${mn}:${ss}`;
}

function initialsFromName(name) {
    const parts = (name || '').trim().split(/\s+/);
    if (!parts.length) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
}

function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

// ────────────────────────────────────────────
// Session (localStorage)
// ────────────────────────────────────────────
function getCurrentUser() {
    try {
        const raw = localStorage.getItem('cris_session');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) { return null; }
}

function setCurrentUser(user) {
    localStorage.setItem('cris_session', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('cris_session');
}

function requireAuth(redirectTo = 'index.html') {
    if (!getCurrentUser()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

// ────────────────────────────────────────────
// Flash messages (sessionStorage — survives one redirect)
// ────────────────────────────────────────────
function setFlash(message, type = 'success') {
    sessionStorage.setItem('cris_flash', JSON.stringify({ message, type }));
}

function consumeFlash() {
    const raw = sessionStorage.getItem('cris_flash');
    if (!raw) return null;
    sessionStorage.removeItem('cris_flash');
    try { return JSON.parse(raw); } catch (e) { return null; }
}

// ────────────────────────────────────────────
// Toast notifications (live + flash)
// ────────────────────────────────────────────
const SUCCESS_ICON = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
const ERROR_ICON = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

function ensureToastStack() {
    let stack = document.getElementById('toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.className = 'toast-stack';
        stack.id = 'toast-stack';
        document.body.appendChild(stack);
    }
    return stack;
}

function showToast(message, type = 'success') {
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = (type === 'success' ? SUCCESS_ICON : ERROR_ICON) + `<div class="toast-text">${escapeHtml(message)}</div>`;
    stack.appendChild(el);
    const timer = setTimeout(() => dismissToast(el), 4500);
    el.addEventListener('click', () => { clearTimeout(timer); dismissToast(el); });
}

function dismissToast(el) {
    el.classList.add('dismissing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
}

function showFlashIfAny() {
    const flash = consumeFlash();
    if (flash) showToast(flash.message, flash.type);
}

// ────────────────────────────────────────────
// IndexedDB file store
// ────────────────────────────────────────────
const DB_NAME = 'cris_portal';
const DB_VERSION = 1;
const STORE = 'files';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'name' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function addFileRecord(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function getFileRecord(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(name);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function getAllFileRecords() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function deleteFileRecord(name) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function fileExists(name) {
    return (await getFileRecord(name)) !== null;
}

async function getUniqueFilename(filename) {
    if (!(await fileExists(filename))) return filename;
    const dot = filename.lastIndexOf('.');
    const base = dot >= 0 ? filename.slice(0, dot) : filename;
    const ext  = dot >= 0 ? filename.slice(dot)    : '';
    let n = 1;
    while (await fileExists(`${base}_${n}${ext}`)) n++;
    return `${base}_${n}${ext}`;
}

function sanitiseFilename(name) {
    // Strip path separators and weird chars; mirror werkzeug.secure_filename loosely.
    return name
        .replace(/[\\/]/g, '_')
        .replace(/[^A-Za-z0-9._\-() ]/g, '_')
        .replace(/_+/g, '_')
        .trim();
}

async function listFilesEnriched() {
    const records = await getAllFileRecords();
    const out = records.map(r => {
        const ext = getExtension(r.name);
        const cat = getFileCategory(ext);
        return {
            name: r.name,
            size: formatSize(r.size),
            size_bytes: r.size,
            modified: formatDate(new Date(r.modifiedTs)),
            modified_ts: Math.floor(r.modifiedTs / 1000),
            extension: ext,
            category_label: cat.label,
            icon_class: cat.icon,
            previewable: isPreviewable(ext),
            type: r.type,
        };
    });
    out.sort((a, b) => b.modified_ts - a.modified_ts);
    return out;
}

// ────────────────────────────────────────────
// Activity log (localStorage, capped at 200)
// ────────────────────────────────────────────
function getActivityLog() {
    try {
        const raw = localStorage.getItem('cris_activity');
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) { return []; }
}

function logActivity(action, target = '') {
    const user = getCurrentUser();
    const now = new Date();
    const entry = {
        ts: now.getTime(),
        time: formatDateTime(now),
        user: user ? user.name : 'System',
        role: user ? user.role : '—',
        action: action,
        target: target,
    };
    const log = getActivityLog();
    log.push(entry);
    if (log.length > 200) log.splice(0, log.length - 200);
    localStorage.setItem('cris_activity', JSON.stringify(log));
}

// ────────────────────────────────────────────
// Topbar & sidebar — rendered into <body>
// ────────────────────────────────────────────
function renderAppShell(activePage) {
    const user = getCurrentUser();
    if (!user) return; // requireAuth would have redirected already

    const topbarHTML = `
        <header class="topbar">
            <div class="topbar-left">
                <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Toggle navigation">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <a href="dashboard.html" class="brand">
                    <div class="brand-logo">CRIS</div>
                    <div class="brand-text">
                        <div class="brand-title">Document Portal</div>
                        <div class="brand-sub">Centre for Railway Information Systems</div>
                    </div>
                </a>
            </div>
            <div class="topbar-right">
                <button class="notif-btn" aria-label="Notifications" title="Notifications">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <span class="notif-badge">3</span>
                </button>
                <div class="user-menu" id="user-menu">
                    <button class="user-menu-trigger" id="user-menu-trigger" aria-haspopup="true" aria-expanded="false">
                        <div class="user-avatar">${escapeHtml(initialsFromName(user.name))}</div>
                        <div class="user-meta">
                            <div class="user-name">${escapeHtml(user.name)}</div>
                            <div class="user-role">${escapeHtml(user.role)}</div>
                        </div>
                        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="user-dropdown" role="menu">
                        <div class="user-dropdown-header">
                            <div class="name">${escapeHtml(user.name)}</div>
                            <div class="designation">${escapeHtml(user.designation)}</div>
                            <div class="empid">${escapeHtml(user.employee_id)}</div>
                        </div>
                        <a href="#" role="menuitem">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            My Profile
                        </a>
                        <a href="#" role="menuitem">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            Settings
                        </a>
                        <hr>
                        <a href="#" class="signout" id="signout-btn" role="menuitem">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Sign Out
                        </a>
                    </div>
                </div>
            </div>
        </header>
        <div class="tricolor" aria-hidden="true">
            <div class="saffron"></div>
            <div class="white"></div>
            <div class="green"></div>
        </div>
    `;

    const navLinks = [
        { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard', hi: 'डैशबोर्ड', icon: '<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>' },
        { id: 'documents', href: 'documents.html', label: 'Documents', hi: 'दस्तावेज़', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>' },
        { id: 'activity',  href: 'activity.html',  label: 'Activity',  hi: 'गतिविधि',  icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>' },
    ];
    const toolsLinks = [
        { href: '#', label: 'Help',     hi: 'सहायता',   icon: '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>' },
        { href: '#', label: 'Settings', hi: 'सेटिंग्स', icon: '<circle cx="12" cy="12" r="3"></circle>' },
    ];

    const sidebarHTML = `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-section">
                <div class="sidebar-section-label">Main</div>
                ${navLinks.map(l => `
                    <a href="${l.href}" class="sidebar-link${activePage === l.id ? ' active' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${l.icon}</svg>
                        <span>${l.label}</span>
                        <span class="sidebar-link-hi">${l.hi}</span>
                    </a>
                `).join('')}
            </div>
            <div class="sidebar-section">
                <div class="sidebar-section-label">Tools</div>
                ${toolsLinks.map(l => `
                    <a href="${l.href}" class="sidebar-link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${l.icon}</svg>
                        <span>${l.label}</span>
                        <span class="sidebar-link-hi">${l.hi}</span>
                    </a>
                `).join('')}
            </div>
            <div class="sidebar-footer">
                <div class="label">Last Login</div>
                <div class="value">${escapeHtml(user.loginTime || '—')}</div>
            </div>
        </aside>
    `;

    // Inject topbar at top of body, then wrap main content
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    const mainHTML = mainContent.innerHTML;
    document.body.innerHTML = topbarHTML + `<div class="layout">${sidebarHTML}<main class="main" id="main">${mainHTML}<div class="footer"><strong>CRIS Document Portal</strong> · Centre for Railway Information Systems · Ministry of Railways, Government of India</div></main></div>`;

    wireUserMenu();
    wireSidebarToggle();
    wireSignOut();
}

function wireUserMenu() {
    const menu = document.getElementById('user-menu');
    const trigger = document.getElementById('user-menu-trigger');
    if (!menu || !trigger) return;
    trigger.addEventListener('click', e => {
        e.stopPropagation();
        menu.classList.toggle('open');
        trigger.setAttribute('aria-expanded', menu.classList.contains('open'));
    });
    document.addEventListener('click', e => {
        if (!menu.contains(e.target)) {
            menu.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            menu.classList.remove('open');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

function wireSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
}

function wireSignOut() {
    const btn = document.getElementById('signout-btn');
    if (!btn) return;
    btn.addEventListener('click', e => {
        e.preventDefault();
        logActivity('Signed out');
        clearSession();
        setFlash('You have been signed out.', 'success');
        window.location.href = 'index.html';
    });
}

// ────────────────────────────────────────────
// Stat counter animation
// ────────────────────────────────────────────
function animateCounters() {
    document.querySelectorAll('[data-counter]').forEach(el => {
        const target = parseInt(el.dataset.counter, 10) || 0;
        if (target === 0) return;
        const duration = 700;
        const start = performance.now();
        el.textContent = '0';
        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased);
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

// ────────────────────────────────────────────
// File downloads & previews (from IndexedDB)
// ────────────────────────────────────────────
async function downloadFile(filename) {
    const record = await getFileRecord(filename);
    if (!record) { showToast('File not found.', 'error'); return; }
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    logActivity('Downloaded', filename);
}

let currentPreviewUrl = null;

async function openPreviewModal(filename, ext) {
    const record = await getFileRecord(filename);
    if (!record) { showToast('File not found.', 'error'); return; }
    if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); }
    currentPreviewUrl = URL.createObjectURL(record.blob);

    const modal = document.getElementById('preview-modal');
    const body  = document.getElementById('preview-modal-body');
    const title = document.getElementById('preview-modal-title');
    if (!modal || !body || !title) return;
    title.textContent = filename;

    const imageExts = ['png','jpg','jpeg','gif','bmp','webp','svg'];
    if (imageExts.includes(ext)) {
        body.innerHTML = `<img src="${currentPreviewUrl}" alt="">`;
    } else if (ext === 'pdf' || ext === 'txt') {
        body.innerHTML = `<iframe src="${currentPreviewUrl}"></iframe>`;
    } else {
        body.innerHTML = '<p style="color:#fff;padding:20px;">Preview not available.</p>';
    }
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    const body  = document.getElementById('preview-modal-body');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
        if (body) body.innerHTML = '';
        if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
    }, 200);
}

async function deleteFile(filename) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    await deleteFileRecord(filename);
    logActivity('Deleted', filename);
    setFlash(`"${filename}" deleted successfully.`, 'success');
    window.location.reload();
}

// ────────────────────────────────────────────
// Upload handler — used by documents page
// ────────────────────────────────────────────
async function handleUpload(files) {
    const items = Array.from(files);
    if (items.length === 0) {
        setFlash('No file selected.', 'error');
        return;
    }
    let success = 0;
    const errors = [];
    for (const file of items) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            errors.push(`"${file.name}" — exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
            continue;
        }
        if (!isAllowed(file.name)) {
            errors.push(`"${file.name}" — file type not allowed.`);
            continue;
        }
        let safe = sanitiseFilename(file.name);
        if (!safe) { errors.push(`"${file.name}" — invalid file name.`); continue; }
        safe = await getUniqueFilename(safe);
        await addFileRecord({
            name: safe,
            blob: file,
            size: file.size,
            type: file.type,
            modifiedTs: Date.now(),
        });
        logActivity('Uploaded', safe);
        success++;
    }
    if (success === 1) setFlash('1 file uploaded successfully.', 'success');
    else if (success > 1) setFlash(`${success} files uploaded successfully.`, 'success');
    if (errors.length) {
        // We can only flash one message; show the first error here too via toast
        for (const e of errors) showToast(e, 'error');
    }
    if (success > 0) window.location.reload();
}
