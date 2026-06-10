/* ============================================================
   LYCEUM CONNECT — GLOBAL JAVASCRIPT
   ============================================================ */

'use strict';

// ---- Dark Mode ----
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('lc-theme', isDark ? 'light' : 'dark');
}

(function initTheme() {
  const saved = localStorage.getItem('lc-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// ---- Sidebar Toggle ----
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    const main = document.querySelector('.main-content');
    if (main) main.style.marginLeft = sidebar.classList.contains('collapsed')
      ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)';
  }
}

// Close mobile sidebar on overlay click
document.addEventListener('click', function(e) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
    if (!sidebar.contains(e.target) && !e.target.closest('#sidebarToggle')) {
      sidebar.classList.remove('mobile-open');
    }
  }
});

// ---- Notifications Dropdown ----
function toggleNotifications() {
  const dropdown = document.getElementById('notifDropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('open');
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('notifDropdown');
  const btn = document.getElementById('notifBtn');
  if (!dropdown || !btn) return;
  if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

// ---- AI Chat Widget ----
function toggleAIChat() {
  const panel = document.getElementById('aiChatPanel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    setTimeout(() => document.getElementById('aiChatInput')?.focus(), 100);
  }
}

function sendAIMessage() {
  const input = document.getElementById('aiChatInput');
  if (!input || !input.value.trim()) return;
  const msg = input.value.trim();
  input.value = '';
  addAIMessage(msg, 'user');
  setTimeout(() => {
    const response = getAIResponse(msg);
    addAIMessage(response, 'bot');
  }, 700);
}

function addAIMessage(text, type) {
  const messages = document.getElementById('aiMessages');
  if (!messages) return;
  const div = document.createElement('div');
  div.className = `ai-msg ${type}`;
  div.innerHTML = `<div class="ai-msg-bubble">${text}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function getAIResponse(msg) {
  const m = msg.toLowerCase();
  if (m.includes('it') || m.includes('ticket') || m.includes('technical')) {
    return 'I can help you raise an IT ticket! Go to <b>Service Catalog → IT Support</b> and select "Technical Support Request". Expected SLA: 4 hours for high priority.';
  } else if (m.includes('leave') || m.includes('hr') || m.includes('letter')) {
    return 'For HR services like service letters, visit <b>Service Catalog → Human Resources</b>. Service letters are processed within 2 business days.';
  } else if (m.includes('stationery') || m.includes('courier') || m.includes('admin')) {
    return 'Administrative requests like stationery or courier services can be raised via <b>Service Catalog → Administration</b>.';
  } else if (m.includes('policy') || m.includes('procedure') || m.includes('sop')) {
    return 'You can find all policies, SOPs and procedures in the <b>Knowledge Center</b>. Use the search or browse by category.';
  } else if (m.includes('request') || m.includes('status') || m.includes('track')) {
    return 'Track all your requests in <b>My Requests</b>. You can see open, pending, in-progress, and completed requests with real-time status updates.';
  } else if (m.includes('hello') || m.includes('hi') || m.includes('help')) {
    return 'Hello! I\'m Lexi, your AI assistant. I can help you find services, answer policy questions, track requests, or guide you anywhere in Lyceum Connect. What do you need?';
  } else {
    return 'I can help you navigate Lyceum Connect. Try asking about IT support, HR services, policies, or request tracking. What do you need?';
  }
}

function sendAISuggestion(text) {
  const input = document.getElementById('aiChatInput');
  if (!input) return;
  input.value = text;
  sendAIMessage();
}

// AI Enter key
document.addEventListener('DOMContentLoaded', function() {
  const aiInput = document.getElementById('aiChatInput');
  if (aiInput) {
    aiInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') sendAIMessage();
    });
  }
});

// ---- Global Search ----
const searchData = [
  { type: 'service', name: 'Raise IT Ticket', desc: 'IT Department', url: 'request-form.html?service=it-ticket' },
  { type: 'service', name: 'Service Letter Request', desc: 'Human Resources', url: 'request-form.html?service=service-letter' },
  { type: 'service', name: 'Facility Request', desc: 'Group Facility Management', url: 'request-form.html?service=facility' },
  { type: 'service', name: 'Password Reset', desc: 'IT Department', url: 'request-form.html?service=password' },
  { type: 'service', name: 'Asset Request', desc: 'IT Department', url: 'request-form.html?service=asset' },
  { type: 'employee', name: 'Sudaraka Perera', desc: 'IT Governance Lead · IT Governance', url: 'employee-directory.html' },
  { type: 'employee', name: 'Raj Patel', desc: 'IT Manager · Information Technology', url: 'employee-directory.html' },
  { type: 'document', name: 'Employee Handbook 2025', desc: 'HR Policy', url: 'knowledge-center.html' },
  { type: 'document', name: 'IT Security Policy', desc: 'IT Policy', url: 'knowledge-center.html' },
  { type: 'document', name: 'Leave Policy', desc: 'HR Policy', url: 'knowledge-center.html' },
  { type: 'page', name: 'Service Catalog', desc: 'Browse all services', url: 'service-catalog.html' },
  { type: 'page', name: 'My Requests', desc: 'Track your requests', url: 'request-tracking.html' },
  { type: 'page', name: 'Knowledge Center', desc: 'Policies and documents', url: 'knowledge-center.html' },
];

function initSearch() {
  const input = document.getElementById('globalSearch');
  if (!input) return;

  input.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    if (!q) { resultsEl.classList.remove('open'); return; }

    const filtered = searchData.filter(item =>
      item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    ).slice(0, 8);

    if (!filtered.length) { resultsEl.classList.remove('open'); return; }

    const typeIcons = {
      service:  '#3A9AD9',
      employee: '#7C3AED',
      document: '#0D9488',
      page:     '#F59E0B',
    };

    const typeLabels = {
      service:  '⚙',
      employee: '👤',
      document: '📄',
      page:     '🔗',
    };

    resultsEl.innerHTML = filtered.map(item => `
      <a href="${item.url}" class="search-result-item" style="text-decoration:none">
        <div class="search-result-icon" style="background:${typeIcons[item.type]}20;color:${typeIcons[item.type]}">
          <span style="font-size:16px">${typeLabels[item.type]}</span>
        </div>
        <div>
          <div class="search-result-name">${item.name}</div>
          <div class="search-result-sub">${item.desc}</div>
        </div>
      </a>
    `).join('');

    resultsEl.classList.add('open');
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const resultsEl = document.getElementById('searchResults');
      if (resultsEl) resultsEl.classList.remove('open');
      this.blur();
    }
  });

  document.addEventListener('click', function(e) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;
    if (!resultsEl.contains(e.target) && e.target !== input) {
      resultsEl.classList.remove('open');
    }
  });

  // Keyboard shortcut ⌘K
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ---- Toast Notifications ----
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);padding:4px;border-radius:6px;display:flex;align-items:center">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---- Tab System ----
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabGroup = this.closest('[data-tabs]') || this.closest('.tabs-wrapper');
      if (!tabGroup) return;
      tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const target = this.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('active', c.id === target);
      });
    });
  });
}

// ---- Dropdown Menus ----
function initDropdowns() {
  document.querySelectorAll('[data-dropdown]').forEach(trigger => {
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      const targetId = this.getAttribute('data-dropdown');
      const target = document.getElementById(targetId);
      if (target) target.classList.toggle('open');
    });
  });

  document.addEventListener('click', function() {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  });
}

// ---- Progress bar animation on scroll ----
function animateProgressBars() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target.querySelector('.progress-fill');
        if (bar) {
          const width = bar.getAttribute('data-width') || bar.style.width;
          bar.style.width = '0';
          setTimeout(() => { bar.style.width = width; }, 100);
        }
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.progress-bar').forEach(bar => observer.observe(bar));
}

// ---- Date/Time ----
function updateDateTime() {
  const el = document.getElementById('currentDateTime');
  if (!el) return;
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { day: '2-digit' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const year = now.getFullYear();
  el.textContent = `${weekday}, ${day} ${month} ${year}`;
}

// ---- Form Submission ----
function submitRequest(formId, redirectUrl) {
  const form = document.getElementById(formId);
  if (!form) return;
  const inputs = form.querySelectorAll('[required]');
  let valid = true;
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.style.borderColor = 'var(--error)';
      valid = false;
      input.addEventListener('input', () => input.style.borderColor = '', { once: true });
    }
  });
  if (!valid) {
    showToast('Please fill all required fields', '', 'error');
    return;
  }
  showToast('Request Submitted Successfully!', 'Your request has been raised and you will be notified of updates.', 'success');
  setTimeout(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, 1500);
}

// ---- Number Counter Animation ----
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count'));
    const duration = 1000;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current);
      if (current >= target) clearInterval(timer);
    }, 16);
  });
}

// ---- Favourite Services ----
const favourites = JSON.parse(localStorage.getItem('lc-favourites') || '[]');

function toggleFavourite(serviceId, btn) {
  const idx = favourites.indexOf(serviceId);
  if (idx > -1) {
    favourites.splice(idx, 1);
    if (btn) btn.classList.remove('active');
    showToast('Removed from Favourites', serviceId, 'info');
  } else {
    favourites.push(serviceId);
    if (btn) btn.classList.add('active');
    showToast('Added to Favourites', serviceId, 'success');
  }
  localStorage.setItem('lc-favourites', JSON.stringify(favourites));
}

// ---- Upload Zone ----
function initUploadZones() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input = zone.querySelector('input[type=file]');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--primary)'; });
    zone.addEventListener('dragleave', () => zone.style.borderColor = '');
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = '';
      const files = e.dataTransfer?.files;
      if (files && input) { input.files = files; updateFileList(files, zone); }
    });
    zone.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => updateFileList(input.files, zone));
  });
}

function updateFileList(files, zone) {
  let list = zone.querySelector('.file-list');
  if (!list) { list = document.createElement('div'); list.className = 'file-list'; zone.appendChild(list); }
  list.innerHTML = Array.from(files).map(f =>
    `<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;display:flex;align-items:center;gap:6px">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      ${f.name}
    </div>`
  ).join('');
}

// ---- Modal System ----
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Close modal on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    const aiPanel = document.getElementById('aiChatPanel');
    if (aiPanel) aiPanel.classList.remove('open');
  }
});

// Apply the profile saved on the Profile page (name + avatar initials)
// across every page's sidebar, topbar and dashboard greeting.
function applyStoredProfile() {
  let p;
  try { p = JSON.parse(localStorage.getItem('lc-profile') || '{}'); } catch (e) { p = {}; }
  if (!p || (!p.firstNameVal && !p.lastNameVal)) return;

  const first = (p.firstNameVal || 'Sudaraka').trim();
  const last = (p.lastNameVal || 'Perera').trim();
  const full = `${first} ${last}`.trim();
  const initials = ((first.charAt(0) || '') + (last.charAt(0) || '')).toUpperCase();

  document.querySelectorAll('.sidebar-user-name, .topbar-user-name').forEach(el => { el.textContent = full; });
  document.querySelectorAll('.sidebar-avatar, .topbar-avatar').forEach(el => { el.textContent = initials; });
  const welcome = document.getElementById('welcomeUserName');
  if (welcome) welcome.textContent = first;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', function() {
  applyStoredProfile();
  initSearch();
  initTabs();
  initDropdowns();
  animateProgressBars();
  updateDateTime();
  initUploadZones();
  animateCounters();

  // Init Lucide icons if available
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Set active nav item based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      item.classList.add('active');
    }
  });

  // Render tasks widget if on index.html
  if (currentPage === 'index.html' || currentPage === '') {
    seedSampleTasks();
    renderDashboardTasks();
  }
});

// Seed data definition
const SAMPLE_MEETING_TASKS = [
  // Meeting 1: Q3 Budget Review — June 3, 2026
  {
    id: 'TSK-SEED-001',
    title: 'Prepare revised Q3 budget projection with updated enrollment figures',
    assignee: 'Lisa Thompson',
    dueDate: '2026-06-12',
    priority: 'High',
    completed: false,
    meetingTitle: 'Q3 Budget Review — June 3',
    dateCreated: '6/3/2026'
  },
  {
    id: 'TSK-SEED-002',
    title: 'Submit capital expenditure approval form for new campus servers',
    assignee: 'Raj Patel',
    dueDate: '2026-06-10',
    priority: 'High',
    completed: true,
    meetingTitle: 'Q3 Budget Review — June 3',
    dateCreated: '6/3/2026'
  },
  {
    id: 'TSK-SEED-003',
    title: 'Consolidate department spend reports and share with finance team',
    assignee: 'Sudaraka Perera',
    dueDate: '2026-06-14',
    priority: 'Medium',
    completed: false,
    meetingTitle: 'Q3 Budget Review — June 3',
    dateCreated: '6/3/2026'
  },
  {
    id: 'TSK-SEED-004',
    title: 'Schedule follow-up meeting with procurement for vendor renegotiation',
    assignee: 'Lisa Thompson',
    dueDate: '2026-06-09',
    priority: 'Low',
    completed: true,
    meetingTitle: 'Q3 Budget Review — June 3',
    dateCreated: '6/3/2026'
  },

  // Meeting 2: IT Infrastructure Planning — June 5, 2026
  {
    id: 'TSK-SEED-005',
    title: 'Audit current network bandwidth across all campus locations',
    assignee: 'James Wilson',
    dueDate: '2026-06-15',
    priority: 'High',
    completed: false,
    meetingTitle: 'IT Infrastructure Planning — June 5',
    dateCreated: '6/5/2026'
  },
  {
    id: 'TSK-SEED-006',
    title: 'Draft RFP for cloud migration of legacy student records system',
    assignee: 'Raj Patel',
    dueDate: '2026-06-18',
    priority: 'High',
    completed: false,
    meetingTitle: 'IT Infrastructure Planning — June 5',
    dateCreated: '6/5/2026'
  },
  {
    id: 'TSK-SEED-007',
    title: 'Evaluate Azure vs AWS pricing for disaster recovery hosting',
    assignee: 'Sudaraka Perera',
    dueDate: '2026-06-20',
    priority: 'Medium',
    completed: false,
    meetingTitle: 'IT Infrastructure Planning — June 5',
    dateCreated: '6/5/2026'
  },
  {
    id: 'TSK-SEED-008',
    title: 'Complete endpoint security rollout for teacher laptops — Phase 2',
    assignee: 'James Wilson',
    dueDate: '2026-06-13',
    priority: 'High',
    completed: true,
    meetingTitle: 'IT Infrastructure Planning — June 5',
    dateCreated: '6/5/2026'
  },

  // Meeting 3: HR Policy Update — June 7, 2026
  {
    id: 'TSK-SEED-009',
    title: 'Circulate updated work-from-home policy draft to all department heads',
    assignee: 'Lisa Thompson',
    dueDate: '2026-06-11',
    priority: 'Medium',
    completed: false,
    meetingTitle: 'HR Policy Update — June 7',
    dateCreated: '6/7/2026'
  },
  {
    id: 'TSK-SEED-010',
    title: 'Compile employee feedback survey results from May wellbeing check-in',
    assignee: 'Sudaraka Perera',
    dueDate: '2026-06-16',
    priority: 'Medium',
    completed: false,
    meetingTitle: 'HR Policy Update — June 7',
    dateCreated: '6/7/2026'
  },
  {
    id: 'TSK-SEED-011',
    title: 'Update onboarding handbook with new mandatory compliance training modules',
    assignee: 'Raj Patel',
    dueDate: '2026-06-22',
    priority: 'Low',
    completed: false,
    meetingTitle: 'HR Policy Update — June 7',
    dateCreated: '6/7/2026'
  },
  {
    id: 'TSK-SEED-012',
    title: 'Confirm new leave approval workflow integration with Lyceum Connect portal',
    assignee: 'James Wilson',
    dueDate: '2026-06-19',
    priority: 'High',
    completed: false,
    meetingTitle: 'HR Policy Update — June 7',
    dateCreated: '6/7/2026'
  },
  {
    id: 'TSK-SEED-013',
    title: 'Integrate Bitrock payment gateway APIs into the student portal registrations link',
    assignee: 'Raj Patel',
    dueDate: '2026-06-25',
    priority: 'High',
    completed: false,
    meetingTitle: 'IT Infrastructure Planning — June 5',
    dateCreated: '6/5/2026'
  },
  {
    id: 'TSK-SEED-014',
    title: 'Organize launch event schedule for Zeus Gymnasium corporate wellness challenge',
    assignee: 'Lisa Thompson',
    dueDate: '2026-06-18',
    priority: 'Medium',
    completed: false,
    meetingTitle: 'HR Policy Update — June 7',
    dateCreated: '6/7/2026'
  },
  {
    id: 'TSK-SEED-015',
    title: 'Review and draft lease agreement for the new NCG Warehouse logistics hub',
    assignee: 'Sudaraka Perera',
    dueDate: '2026-06-20',
    priority: 'Low',
    completed: false,
    meetingTitle: 'Q3 Budget Review — June 3',
    dateCreated: '6/3/2026'
  },
  {
    id: 'TSK-SEED-016',
    title: 'Coordinate Nextgen Publications syllabus distribution logistics review',
    assignee: 'James Wilson',
    dueDate: '2026-06-14',
    priority: 'Medium',
    completed: true,
    meetingTitle: 'HR Policy Update — June 7',
    dateCreated: '6/7/2026'
  }
];

function seedSampleTasks() {
  let existing = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  const existingIds = existing.map(t => t.id);
  const missingSamples = SAMPLE_MEETING_TASKS.filter(t => !existingIds.includes(t.id));

  if (missingSamples.length > 0) {
    existing = [...existing, ...missingSamples];
    localStorage.setItem('lc-tasks', JSON.stringify(existing));
  }
}

// ============================================================
// 13. Portal Homepage Action Tasks Tracker Controller
// ============================================================

function renderDashboardTasks() {
  const container = document.getElementById('homepageTaskList');
  const counter = document.getElementById('taskCounter');
  if (!container) return;

  const tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  
  // Get search filter input
  const searchInput = document.getElementById('taskSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  // Get status filter selection
  const statusSelect = document.getElementById('taskFilterStatus');
  const statusFilter = statusSelect ? statusSelect.value : 'all';

  // Get priority filter selection
  const prioritySelect = document.getElementById('taskFilterPriority');
  const priorityFilter = prioritySelect ? prioritySelect.value : 'all';

  // Apply filtering
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !query || 
      task.title.toLowerCase().includes(query) || 
      task.assignee.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && !task.completed) || 
      (statusFilter === 'completed' && task.completed);

    const matchesPriority = priorityFilter === 'all' || 
      task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (counter) {
    const activeTasks = tasks.filter(t => !t.completed).length;
    counter.textContent = `${activeTasks} Active / ${tasks.length} Total`;
    counter.className = activeTasks > 0 ? 'badge badge-blue' : 'badge badge-green';
  }

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:var(--space-6); color:var(--text-tertiary); font-size:13.5px">
        🔍 No matching tasks found.
      </div>
    `;
    return;
  }

  container.innerHTML = filteredTasks.map(task => {
    const priorityClass = task.priority === 'High' ? 'badge-red' : task.priority === 'Medium' ? 'badge-amber' : 'badge-gray';
    const textStyle = task.completed ? 'text-decoration: line-through; color: var(--text-tertiary); font-style: italic' : 'color: var(--text-primary)';
    
    // Render reminder metadata if present
    let reminderText = '';
    if (task.lastReminder) {
      reminderText = `<span>•</span><span style="color:var(--primary); font-weight:500; display:inline-flex; align-items:center; gap:3px" title="Sent to ${task.lastReminder.recipient}">🔔 Last reminder: ${task.lastReminder.type} (${task.lastReminder.time})</span>`;
    }

    return `
      <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px var(--space-4); display:flex; align-items:center; justify-content:space-between; gap:16px">
        <div style="display:flex; align-items:center; gap:var(--space-3); flex:1">
          <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTask('${task.id}')" style="width:18px; height:18px; cursor:pointer; accent-color:var(--primary)">
          <div style="flex:1">
            <div style="font-weight:600; font-size:13.5px; ${textStyle}">${task.title}</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap">
              <span>👤 Assignee: <b>${task.assignee}</b></span>
              <span>•</span>
              <span>📅 Due: <b>${task.dueDate}</b></span>
              <span>•</span>
              <span>🔗 Origin: <b>${task.meetingTitle}</b></span>
              ${reminderText}
            </div>
          </div>
        </div>
        
        <div style="display:flex; align-items:center; gap:var(--space-3)">
          <span class="badge ${priorityClass}" style="font-size:10px; font-weight:700">${task.priority}</span>
          
          <!-- Remind Dropdown Button -->
          <div style="position:relative; display:inline-block">
            <button class="btn btn-outline btn-sm btn-icon" data-remind-btn="${task.id}" onclick="toggleReminderMenu('${task.id}', event)" style="gap:4px; font-size:11px; padding:4px 8px; height:28px" title="Send Reminder" ${task.completed ? 'disabled' : ''}>
              🔔 Remind
            </button>
            <div id="reminder-menu-${task.id}" class="reminder-dropdown-menu">
              <button class="reminder-dropdown-item" onclick="sendReminder('${task.id}', 'email')">
                📧 Email Notification
              </button>
              <button class="reminder-dropdown-item" onclick="sendReminder('${task.id}', 'telegram')">
                💬 Telegram Message
              </button>
            </div>
          </div>

          <!-- Edit Button -->
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditModal('${task.id}')" style="padding:4px 8px" title="Edit Task">✏️</button>

          <!-- Delete Button -->
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTask('${task.id}')" style="color:var(--error); padding:4px 8px" title="Delete Task">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

window.toggleTask = function(id) {
  let tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  tasks = tasks.map(t => {
    if (t.id === id) {
      t.completed = !t.completed;
    }
    return t;
  });
  localStorage.setItem('lc-tasks', JSON.stringify(tasks));
  renderDashboardTasks();
};

window.deleteTask = function(id) {
  if (confirm('Are you sure you want to delete this task?')) {
    let tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem('lc-tasks', JSON.stringify(tasks));
    renderDashboardTasks();
  }
};

// Toggle Reminder Dropdown Menu
window.toggleReminderMenu = function(taskId, event) {
  event.stopPropagation();
  
  // Close any other open dropdowns
  document.querySelectorAll('.reminder-dropdown-menu').forEach(menu => {
    if (menu.id !== `reminder-menu-${taskId}`) {
      menu.classList.remove('show');
    }
  });

  const menu = document.getElementById(`reminder-menu-${taskId}`);
  if (menu) {
    menu.classList.toggle('show');
  }
};

// Global click listener to close dropdowns on outer click
document.addEventListener('click', function() {
  document.querySelectorAll('.reminder-dropdown-menu').forEach(menu => {
    menu.classList.remove('show');
  });
});

// Staff directory lookup for Email/Telegram simulation
window.STAFF_DIRECTORIES = window.STAFF_DIRECTORIES || {
  'lisa thompson': { email: 'lisa.thompson@lyceum.edu', telegram: '@lisa_t_lyceum' },
  'lisa': { email: 'lisa.thompson@lyceum.edu', telegram: '@lisa_t_lyceum' },
  'raj patel': { email: 'raj.patel@lyceum.edu', telegram: '@raj_patel_it' },
  'raj': { email: 'raj.patel@lyceum.edu', telegram: '@raj_patel_it' },
  'james wilson': { email: 'james.wilson@lyceum.edu', telegram: '@james_net_eng' },
  'james': { email: 'james.wilson@lyceum.edu', telegram: '@james_net_eng' },
  'sudaraka perera': { email: 'sudaraka.perera@lyceum.edu', telegram: '@sudaraka_p_it' },
  'sudaraka': { email: 'sudaraka.perera@lyceum.edu', telegram: '@sudaraka_p_it' }
};

// Dispatch simulated Email or Telegram reminders
window.sendReminder = function(taskId, channel) {
  let tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;
  const task = tasks[taskIndex];

  // Set visual loading state
  const remindBtn = document.querySelector(`[data-remind-btn="${taskId}"]`);
  if (remindBtn) {
    remindBtn.disabled = true;
    remindBtn.innerHTML = `⌛ Sending...`;
  }

  setTimeout(() => {
    const assigneeLower = task.assignee.toLowerCase().trim();
    let contactInfo = { 
      email: `${assigneeLower.replace(/\s+/g, '.')}@lyceum.edu`, 
      telegram: `@${assigneeLower.replace(/\s+/g, '_')}_connect` 
    };

    // Attempt standard lookup
    for (const key in STAFF_DIRECTORIES) {
      if (assigneeLower.includes(key)) {
        contactInfo = STAFF_DIRECTORIES[key];
        break;
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

    // Store reminder logs
    task.lastReminder = {
      type: channel === 'email' ? 'Email' : 'Telegram',
      time: timeStr,
      recipient: channel === 'email' ? contactInfo.email : contactInfo.telegram
    };

    tasks[taskIndex] = task;
    localStorage.setItem('lc-tasks', JSON.stringify(tasks));

    // Show nice custom premium toast
    if (channel === 'email') {
      showToast(
        `📧 Email Sent to ${task.assignee}`,
        `<b>To:</b> ${contactInfo.email}<br><b>Subject:</b> Action Item: ${task.title}<br><b>Body:</b> Hello ${task.assignee}, you are assigned this task. Due: ${task.dueDate}.`,
        'success'
      );
    } else {
      showToast(
        `💬 Telegram Sent to ${task.assignee}`,
        `<b>Recipient:</b> ${contactInfo.telegram}<br><b>Message:</b> 🔔 Reminder: "${task.title}" is due by ${task.dueDate}. Please update status.`,
        'success'
      );
    }

    renderDashboardTasks();
  }, 1200);
};

// Edit Task Modal Handlers
window.openEditModal = function(taskId) {
  const tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskAssignee').value = task.assignee;
  document.getElementById('editTaskDueDate').value = task.dueDate;
  document.getElementById('editTaskPriority').value = task.priority;

  openModal('editTaskModal');
};

window.saveTaskEdit = function() {
  const id = document.getElementById('editTaskId').value;
  const title = document.getElementById('editTaskTitle').value.trim();
  const assignee = document.getElementById('editTaskAssignee').value.trim();
  const dueDate = document.getElementById('editTaskDueDate').value;
  const priority = document.getElementById('editTaskPriority').value;

  if (!title || !assignee || !dueDate) {
    showToast('Invalid Input', 'Please fill in all fields before saving.', 'error');
    return;
  }

  let tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index].title = title;
    tasks[index].assignee = assignee;
    tasks[index].dueDate = dueDate;
    tasks[index].priority = priority;

    localStorage.setItem('lc-tasks', JSON.stringify(tasks));
    closeModal('editTaskModal');
    showToast('Changes Saved', 'The task action item has been successfully updated.', 'success');
    renderDashboardTasks();
  }
};

