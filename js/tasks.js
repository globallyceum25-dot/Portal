/* ============================================================
   LYCEUM CONNECT — TASKS MODULE CONTROLLER
   ============================================================ */

'use strict';

const STORAGE_KEY = 'lc-tasks';

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

// ──────────────────────────────────────────────
// SAMPLE DATA — Pre-seed from meeting minutes
// ──────────────────────────────────────────────
const TASKS_PAGE_SEED = [
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

/**
 * Seed sample tasks into localStorage if they aren't already present
 */
function seedTasksPage() {
  let existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const existingIds = existing.map(t => t.id);
  const missingSamples = TASKS_PAGE_SEED.filter(t => !existingIds.includes(t.id));

  if (missingSamples.length > 0) {
    existing = [...existing, ...missingSamples];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }
}

console.log('Lyceum Connect: tasks.js loaded');

async function initTasksModule() {
  console.log('Lyceum Connect: Initializing tasks module...');
  seedTasksPage();
  // Merge live Supabase tasks (by id) when signed in — never clobbers local edits.
  try {
    if (window.LCData) {
      const d = await window.LCData.tasks();
      if (d.source === 'supabase' && d.rows.length) {
        const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const ids = new Set(local.map(t => t.id));
        const add = d.rows.filter(t => !ids.has(t.id));
        if (add.length) localStorage.setItem(STORAGE_KEY, JSON.stringify([...add, ...local]));
      }
    }
  } catch (e) { /* keep local tasks */ }
  renderTasksList();
  populateMeetingFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTasksModule);
} else {
  initTasksModule();
}

// ──────────────────────────────────────────────
// AI OUTCOME PREDICTION ENGINE
// ──────────────────────────────────────────────
function predictTaskOutcome(task) {
  if (task.completed) {
    return { label: 'Completed', icon: '✅', color: '#059669', bg: '#D1FAE5', confidence: 100, reason: 'Task has been marked complete.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  const hasReminder = !!task.lastReminder;

  if (daysLeft < 0) {
    return { label: 'Overdue', icon: '🚨', color: '#DC2626', bg: '#FEE2E2', confidence: 95, reason: `Past due by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) > 1 ? 's' : ''}. Immediate action required.` };
  }

  if (task.priority === 'High' && daysLeft <= 2) {
    return { label: 'Critical Risk', icon: '🔴', color: '#B91C1C', bg: '#FEE2E2', confidence: 88, reason: `High priority with only ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining.` };
  }

  if (task.priority === 'High' && daysLeft <= 5 && !hasReminder) {
    return { label: 'At Risk', icon: '⚠️', color: '#D97706', bg: '#FEF3C7', confidence: 74, reason: `High priority task due in ${daysLeft} days with no reminders sent yet.` };
  }

  if (task.priority === 'Medium' && daysLeft <= 3) {
    return { label: 'At Risk', icon: '⚠️', color: '#D97706', bg: '#FEF3C7', confidence: 68, reason: `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Consider escalating priority.` };
  }

  if (daysLeft <= 1) {
    return { label: 'Due Soon', icon: '⏰', color: '#EA580C', bg: '#FFEDD5', confidence: 80, reason: 'Due today or tomorrow — take action now.' };
  }

  if (daysLeft <= 5 && hasReminder) {
    return { label: 'On Track', icon: '🟢', color: '#059669', bg: '#D1FAE5', confidence: 82, reason: `Reminder sent, ${daysLeft} days remaining. Good progress expected.` };
  }

  if (daysLeft <= 7) {
    return { label: 'Monitor', icon: '👁️', color: '#2563EB', bg: '#EFF6FF', confidence: 71, reason: `${daysLeft} days left. Watch progress closely.` };
  }

  return { label: 'On Track', icon: '🟢', color: '#059669', bg: '#D1FAE5', confidence: 90, reason: `${daysLeft} days remaining. Well within deadline.` };
}

// Render tasks list & statistics
window.renderTasksList = function renderTasksList() {
  const container = document.getElementById('tasksContainer');
  if (!container) return;

  const tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  // Update Stats Banner
  updateMetricsBanner(tasks);

  // Get filter inputs
  const searchVal = document.getElementById('taskSearchInput')?.value.toLowerCase().trim() || '';
  const statusVal = document.getElementById('taskFilterStatus')?.value || 'all';
  const priorityVal = document.getElementById('taskFilterPriority')?.value || 'all';
  const meetingVal = document.getElementById('taskFilterMeeting')?.value || 'all';

  // Apply filters
  const filtered = tasks.filter(task => {
    const matchesSearch = !searchVal ||
      task.title.toLowerCase().includes(searchVal) ||
      task.assignee.toLowerCase().includes(searchVal) ||
      task.meetingTitle.toLowerCase().includes(searchVal);

    const matchesStatus = statusVal === 'all' ||
      (statusVal === 'active' && !task.completed) ||
      (statusVal === 'completed' && task.completed);

    const matchesPriority = priorityVal === 'all' || task.priority === priorityVal;

    const matchesMeeting = meetingVal === 'all' || task.meetingTitle === meetingVal;

    return matchesSearch && matchesStatus && matchesPriority && matchesMeeting;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:var(--space-8); background:var(--bg-secondary); border:1px dashed var(--border); border-radius:var(--radius-lg); color:var(--text-tertiary)">
        📋 No action tasks match your search filters.
      </div>
    `;
    return;
  }

  // AI Insights summary panel
  const allActive = filtered.filter(t => !t.completed);
  const atRisk = allActive.filter(t => ['At Risk','Critical Risk','Overdue','Due Soon'].includes(predictTaskOutcome(t).label));
  const onTrack = allActive.filter(t => ['On Track'].includes(predictTaskOutcome(t).label));
  const aiInsightsHtml = `
    <div style="background:linear-gradient(135deg,#EFF6FF,#F0FDF4); border:1px solid #BFDBFE; border-radius:var(--radius-lg); padding:14px 18px; margin-bottom:16px; display:flex; align-items:center; gap:16px; flex-wrap:wrap">
      <div style="display:flex; align-items:center; gap:8px; flex-shrink:0">
        <span style="font-size:20px">🤖</span>
        <div>
          <div style="font-size:12px; font-weight:800; color:#1D4ED8; text-transform:uppercase; letter-spacing:0.05em">AI Outcome Prediction</div>
          <div style="font-size:11px; color:#3B82F6; font-weight:500">Analysing ${allActive.length} active task${allActive.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; flex:1">
        <div style="background:#D1FAE5; border:1px solid #6EE7B7; border-radius:8px; padding:6px 12px; text-align:center; min-width:80px">
          <div style="font-size:18px; font-weight:800; color:#059669">${onTrack.length}</div>
          <div style="font-size:10px; font-weight:700; color:#065F46">On Track</div>
        </div>
        <div style="background:#FEF3C7; border:1px solid #FCD34D; border-radius:8px; padding:6px 12px; text-align:center; min-width:80px">
          <div style="font-size:18px; font-weight:800; color:#D97706">${atRisk.length}</div>
          <div style="font-size:10px; font-weight:700; color:#92400E">Needs Attention</div>
        </div>
        <div style="background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px; padding:6px 12px; text-align:center; min-width:80px">
          <div style="font-size:18px; font-weight:800; color:#2563EB">${filtered.filter(t=>t.completed).length}</div>
          <div style="font-size:10px; font-weight:700; color:#1E40AF">Completed</div>
        </div>
      </div>
      <div style="font-size:11.5px; color:#374151; background:rgba(255,255,255,0.7); border-radius:6px; padding:6px 10px; max-width:280px; line-height:1.4">
        💡 ${atRisk.length > 0 ? `<b>${atRisk.length} task${atRisk.length>1?'s':''}</b> need immediate attention. Send reminders or reassign to avoid delays.` : `All active tasks appear to be progressing well. Keep monitoring due dates.`}
      </div>
    </div>
  `;

  container.innerHTML = aiInsightsHtml + filtered.map(task => {
    const priorityClass = task.priority === 'High' ? 'badge-red' : task.priority === 'Medium' ? 'badge-amber' : 'badge-gray';
    const textStyle = task.completed ? 'text-decoration: line-through; color: var(--text-tertiary); font-style: italic' : 'color: var(--text-primary)';
    const prediction = predictTaskOutcome(task);


    let reminderText = '';
    if (task.lastReminder) {
      reminderText = `<span>•</span><span style="color:var(--primary); font-weight:500; display:inline-flex; align-items:center; gap:3px" title="Sent to ${task.lastReminder.recipient}">🔔 Last reminder: ${task.lastReminder.type} (${task.lastReminder.time})</span>`;
    }

    return `
      <div style="background:var(--bg-secondary); border:1px solid var(--border); border-left:3px solid ${prediction.color}; border-radius:var(--radius-md); padding:14px var(--space-4); display:flex; align-items:center; justify-content:space-between; gap:16px">
        <div style="display:flex; align-items:center; gap:var(--space-3); flex:1">
          <input type="checkbox" ${task.completed ? 'checked' : ''} onclick="toggleTaskStatus('${task.id}')" style="width:18px; height:18px; cursor:pointer; accent-color:var(--primary)">
          <div style="flex:1">
            <div style="font-weight:600; font-size:14px; ${textStyle}">${task.title}</div>
            <div style="font-size:11.5px; color:var(--text-secondary); margin-top:2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap">
              <span>👤 Assignee: <b>${task.assignee}</b></span>
              <span>•</span>
              <span>📅 Due: <b>${task.dueDate}</b></span>
              <span>•</span>
              <span>🔗 <b>${task.meetingTitle}</b></span>
              ${reminderText}
            </div>
            <!-- AI Prediction Row -->
            <div style="margin-top:6px; display:inline-flex; align-items:center; gap:6px; background:${prediction.bg}; border:1px solid ${prediction.color}33; border-radius:20px; padding:3px 10px">
              <span style="font-size:12px">${prediction.icon}</span>
              <span style="font-size:11px; font-weight:700; color:${prediction.color}">AI: ${prediction.label}</span>
              <span style="font-size:10px; color:${prediction.color}; opacity:0.8">${prediction.confidence}% confidence</span>
              <span style="font-size:10px; color:var(--text-tertiary); margin-left:2px" title="${prediction.reason}">ℹ️</span>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:var(--space-3)">
          <span class="badge ${priorityClass}" style="font-size:10px; font-weight:700">${task.priority}</span>

          <div style="position:relative; display:inline-block">
            <button class="btn btn-outline btn-sm btn-icon" data-remind-btn="${task.id}" onclick="toggleReminderMenu('${task.id}', event)" style="gap:4px; font-size:11.5px; padding:4px 10px; height:28px" title="Send Reminder" ${task.completed ? 'disabled' : ''}>
              🔔 Remind
            </button>
            <div id="reminder-menu-${task.id}" class="reminder-dropdown-menu">
              <button class="reminder-dropdown-item" onclick="sendReminder('${task.id}', 'email')">📧 Email Notification</button>
              <button class="reminder-dropdown-item" onclick="sendReminder('${task.id}', 'telegram')">💬 Telegram Message</button>
            </div>
          </div>

          <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditModal('${task.id}')" style="padding:4px 8px" title="Edit Task">✏️</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTaskItem('${task.id}')" style="color:var(--error); padding:4px 8px" title="Delete Task">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
};

// Update Stats counters banner
function updateMetricsBanner(tasks) {
  const totalEl = document.getElementById('statsTotal');
  const activeEl = document.getElementById('statsActive');
  const highEl = document.getElementById('statsHigh');
  const completedEl = document.getElementById('statsCompleted');

  if (totalEl) totalEl.textContent = tasks.length;
  if (activeEl) activeEl.textContent = tasks.filter(t => !t.completed).length;
  if (highEl) highEl.textContent = tasks.filter(t => t.priority === 'High' && !t.completed).length;
  if (completedEl) completedEl.textContent = tasks.filter(t => t.completed).length;
}

// Populate Meeting filters list dynamically
function populateMeetingFilters() {
  const select = document.getElementById('taskFilterMeeting');
  if (!select) return;

  const tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const meetings = [...new Set(tasks.map(t => t.meetingTitle))].filter(Boolean);

  select.innerHTML = '<option value="all">All Meeting Origins</option>' +
    meetings.map(m => `<option value="${m}">${m}</option>`).join('');
}

// Toggle task status
window.toggleTaskStatus = function (id) {
  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  tasks = tasks.map(t => {
    if (t.id === id) {
      t.completed = !t.completed;
    }
    return t;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  renderTasksList();
};

// Delete task
window.deleteTaskItem = function (id) {
  if (confirm('Are you sure you want to delete this action task?')) {
    let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    renderTasksList();
    populateMeetingFilters();
    showToast('Task Deleted', 'Action item removed successfully.', 'info');
  }
};

// Toggle dropdown popovers
window.toggleReminderMenu = function (taskId, event) {
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

// Global click dismisses open menus
document.addEventListener('click', function () {
  document.querySelectorAll('.reminder-dropdown-menu').forEach(menu => {
    menu.classList.remove('show');
  });
});

// Dispatch simulated notifications
window.sendReminder = function (taskId, channel) {
  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;
  const task = tasks[taskIndex];

  // Visual button spinner loading state
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

    // Find standard lookup
    for (const key in STAFF_DIRECTORIES) {
      if (assigneeLower.includes(key)) {
        contactInfo = STAFF_DIRECTORIES[key];
        break;
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

    // Update metadata logs
    task.lastReminder = {
      type: channel === 'email' ? 'Email' : 'Telegram',
      time: timeStr,
      recipient: channel === 'email' ? contactInfo.email : contactInfo.telegram
    };

    tasks[taskIndex] = task;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

    // Success dispatch alerts payload
    if (channel === 'email') {
      showToast(
        `📧 Email Sent to ${task.assignee}`,
        `<b>To:</b> ${contactInfo.email}<br><b>Subject:</b> Task Reminder: ${task.title}<br><b>Content:</b> Please complete by ${task.dueDate}.`,
        'success'
      );
    } else {
      showToast(
        `💬 Telegram Sent to ${task.assignee}`,
        `<b>Recipient:</b> ${contactInfo.telegram}<br><b>Content:</b> 🔔 Reminder: "${task.title}" is due by ${task.dueDate}. Please check status.`,
        'success'
      );
    }

    renderTasksList();
  }, 1200);
};

// Edit modal actions
window.openEditModal = function (taskId) {
  const tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskAssignee').value = task.assignee;
  document.getElementById('editTaskDueDate').value = task.dueDate;
  document.getElementById('editTaskPriority').value = task.priority;

  openModal('editTaskModal');
};

window.saveTaskEdit = function () {
  const id = document.getElementById('editTaskId').value;
  const title = document.getElementById('editTaskTitle').value.trim();
  const assignee = document.getElementById('editTaskAssignee').value.trim();
  const dueDate = document.getElementById('editTaskDueDate').value;
  const priority = document.getElementById('editTaskPriority').value;

  if (!title || !assignee || !dueDate) {
    showToast('Invalid Fields', 'All form inputs are required.', 'error');
    return;
  }

  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    tasks[idx].title = title;
    tasks[idx].assignee = assignee;
    tasks[idx].dueDate = dueDate;
    tasks[idx].priority = priority;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    closeModal('editTaskModal');
    showToast('Task Saved', 'Action details updated successfully.', 'success');
    renderTasksList();
  }
};

// Create manual tasks actions
window.openCreateModal = function () {
  document.getElementById('createTaskTitle').value = '';
  document.getElementById('createTaskAssignee').value = '';
  document.getElementById('createTaskOrigin').value = 'Manual Task Creation';

  // Set default due date: 3 days from now
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 3);
  document.getElementById('createTaskDueDate').value = defaultDate.toISOString().split('T')[0];

  openModal('createTaskModal');
};

window.createTaskManually = function () {
  const title = document.getElementById('createTaskTitle').value.trim();
  const assignee = document.getElementById('createTaskAssignee').value.trim();
  const dueDate = document.getElementById('createTaskDueDate').value;
  const priority = document.getElementById('createTaskPriority').value;
  const origin = document.getElementById('createTaskOrigin').value.trim() || 'Manual Task';

  if (!title || !assignee || !dueDate) {
    showToast('Invalid Fields', 'Description, Assignee and Due Date are required.', 'error');
    return;
  }

  const newTask = {
    id: 'TSK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    title: title,
    assignee: assignee,
    dueDate: dueDate,
    priority: priority,
    completed: false,
    meetingTitle: origin,
    dateCreated: new Date().toLocaleDateString('en-US')
  };

  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  tasks.unshift(newTask);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

  closeModal('createTaskModal');
  showToast('Task Created', `"${title}" has been added to your tracker.`, 'success');

  renderTasksList();
  populateMeetingFilters();
};

// Bulk reminders dispatcher for all active tasks
window.dispatchBulkReminders = function () {
  let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const activeTasks = tasks.filter(t => !t.completed);

  if (activeTasks.length === 0) {
    showToast('No Active Tasks', 'There are no active tasks to send reminders for.', 'warning');
    return;
  }

  const btn = document.getElementById('bulkRemindBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `⌛ Dispatching...`;
  }

  setTimeout(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

    const notifiedUsers = [];

    tasks = tasks.map(task => {
      if (!task.completed) {
        const assigneeLower = task.assignee.toLowerCase().trim();
        let contactInfo = {
          email: `${assigneeLower.replace(/\s+/g, '.')}@lyceum.edu`,
          telegram: `@${assigneeLower.replace(/\s+/g, '_')}_connect`
        };

        for (const key in STAFF_DIRECTORIES) {
          if (assigneeLower.includes(key)) {
            contactInfo = STAFF_DIRECTORIES[key];
            break;
          }
        }

        task.lastReminder = {
          type: 'Email + Telegram',
          time: timeStr,
          recipient: `${contactInfo.email} / ${contactInfo.telegram}`
        };

        if (!notifiedUsers.includes(task.assignee)) {
          notifiedUsers.push(task.assignee);
        }
      }
      return task;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `🔔 Send Reminders`;
    }

    showToast(
      `🔔 Bulk Reminders Dispatched!`,
      `Simulated Email & Telegram reminders successfully sent to: <b>${notifiedUsers.join(', ')}</b> regarding <b>${activeTasks.length}</b> active action items.`,
      'success'
    );

    renderTasksList();
  }, 1500);
};

// Toggle Scheduled Auto Reminders
window.toggleAutoReminders = function () {
  const isChecked = document.getElementById('autoRemindToggle')?.checked;
  if (isChecked) {
    showToast('Auto-Reminders Active', 'Simulated background scheduler will auto-remind owners before due dates.', 'success');
  } else {
    showToast('Auto-Reminders Paused', 'Automated schedule reminders have been disabled.', 'warning');
  }
};

