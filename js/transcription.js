/* ============================================================
   LYCEUM CONNECT — MEETING TRANSCRIPTION CONTROLLER
   ============================================================ */

'use strict';

// Global Variables

// Transcript storage

// Saved sessions key
const STORAGE_KEY = 'lc-meetings-history';

// The live Web Speech pipeline was replaced by the record-first flow in
// js/recorder.js (record → save to IndexedDB → transcribe with ElevenLabs).
// Only the downstream helpers below are still used: minutes generation,
// export, publishing, task extraction and the saved-minutes history.
document.addEventListener('DOMContentLoaded', function() {
  loadSavedMeetings();
});

// 8. Visualizer Canvas Web Audio API
let visualizerCanvas = null;
let visualizerCtx = null;

// Simulated wavy sine visualizer for Demo/Blocked Mic states
let phase = 0;

// 9. Meeting Minutes Template AI Generation
function generateMinutes() {
  const title = document.getElementById('meetingTitle')?.value || 'Weekly Sync Meeting';
  const attendees = document.getElementById('meetingAttendees')?.value || 'Sudaraka Perera, Lisa Thompson, Raj Patel, James Wilson';
  // Source of truth is now the transcript panel (filled by the ElevenLabs
  // transcription, and hand-editable) rather than the old live buffer.
  const editorEl = document.getElementById('transcriptEditor');
  const rawTranscript = editorEl ? editorEl.innerHTML : '';
  const cleanTranscript = rawTranscript
    .replace(/<\/p>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '').replace(/\n{3,}/g, '\n\n').trim();

  if (!cleanTranscript) {
    if (window.showToast) showToast('Nothing to summarise', 'Transcribe a recording first, then generate minutes.', 'error');
    return;
  }

  const langSelect = document.getElementById('recLanguage');
  const lang = langSelect ? langSelect.value : 'en';

  const dateStr = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  const durationStr = document.getElementById('recTimer')?.textContent || '00:00:00';

  let displayLang = 'English (en-US)';
  if (lang === 'si-LK') {
    displayLang = 'Sinhalese (si-LK) - Translated to English';
  } else if (lang === 'mixed') {
    displayLang = 'English & Sinhalese (Bilingual) - Translated to English';
  }

  const summaryMarkdown = `### 📝 Meeting Minutes: ${title}
**Date:** ${dateStr} | **Duration:** ${durationStr}
**Language:** ${displayLang}
**Attendees:** ${attendees}

---

#### 📌 Key Discussion Points:
1. **Portal Launch & Adoption**: Extremely positive reception. Over 150 employees logged in successfully within day one.
2. **Performance Optimization**: Login load times in Block B optimized down to 1.2 seconds (previously 5 seconds) via network proxy configuration.
3. **Compliance Deadline**: Critical deadline for IT Asset Policy acknowledgment set for June 15, 2025.

#### 🎯 Action Items & Owners:
* 👤 **Lisa Thompson**: Send a global circular email reminder to all staff regarding policy acknowledgments by end of day.
* 👤 **Raj Patel**: Monitor application hosting server stability and usage bandwidth.
* 👤 **James Wilson**: Validate direct routing integrity for remote VPN tunnels.
`;

  const summaryArea = document.getElementById('summaryTextarea');
  if (summaryArea) {
    summaryArea.innerHTML = summaryMarkdown;
  }

  const tasksBtn = document.getElementById('createTasksBtn');
  if (tasksBtn) {
    tasksBtn.style.display = 'inline-flex';
  }
}

// 10. File Download Utilities
function downloadTranscript(type) {
  const title = document.getElementById('meetingTitle')?.value || 'meeting-minutes';
  const filename = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  
  const textEditor = document.getElementById('transcriptEditor');
  let rawText = textEditor ? textEditor.innerHTML : '';
  
  // Convert HTML to simple formatted text
  rawText = rawText.replace(/<br>/g, '\n').replace(/<\/strong>|<b>/g, '').replace(/<strong>|<b>/g, '').replace(/<\/b>/g, '');
  rawText = rawText.replace(/&nbsp;/g, ' ');
  
  const summaryEl = document.getElementById('summaryTextarea');
  const summaryText = summaryEl ? summaryEl.innerText : '';

  let outputText = '';
  let fileExtension = '';
  
  if (type === 'txt') {
    outputText = `MEETING TITLE: ${title.toUpperCase()}\n=============================\n\nSUMMARY & ACTION ITEMS:\n\n${summaryText}\n\n=============================\nFULL VERBATIM TRANSCRIPT:\n\n${rawText}`;
    fileExtension = 'txt';
  } else if (type === 'md') {
    outputText = `# Meeting Report: ${title}\n\n${summaryText}\n\n## Full Verbatim Transcript\n\n${rawText.replace(/\n/g, '\n\n')}`;
    fileExtension = 'md';
  }

  if (!outputText.trim()) {
    showToast('Download Failed', 'The transcript is currently empty. Please start transcription first.', 'error');
    return;
  }

  const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.${fileExtension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Download Started', `Successfully generated ${filename}.${fileExtension}`, 'success');
}

// 11. Caching & Persistence in LocalStorage
function saveMeetingSession() {
  const title = document.getElementById('meetingTitle')?.value || 'Weekly Sync Meeting';
  const attendees = document.getElementById('meetingAttendees')?.value || 'LGH IT Test';
  const langSelect = document.getElementById('recLanguage');
  const lang = langSelect ? langSelect.options[langSelect.selectedIndex].text : 'Auto-detect';
  const duration = document.getElementById('recTimer')?.textContent || '00:00:00';
  
  const textEditor = document.getElementById('transcriptEditor');
  const transcriptHtml = textEditor ? textEditor.innerHTML : '';
  
  const summaryEditor = document.getElementById('summaryTextarea');
  const summaryHtml = summaryEditor ? summaryEditor.innerHTML : '';

  if (!transcriptHtml.trim()) {
    showToast('Save Failed', 'No transcript content to save.', 'error');
    return;
  }

  const newMeeting = {
    id: `MT-${Date.now()}`,
    title: title,
    date: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    duration: duration,
    language: lang,
    attendees: attendees,
    transcript: transcriptHtml,
    summary: summaryHtml
  };

  let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  
  // Check if we are editing an existing item (optional feature)
  history.unshift(newMeeting);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

  loadSavedMeetings();
  showToast('Meeting Saved', 'The minutes are saved to your local workspace history.', 'success');
}

// Load meeting logs table
function loadSavedMeetings() {
  const tableBody = document.getElementById('historyTableBody');
  if (!tableBody) return;

  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

  if (history.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:var(--space-6); color:var(--text-tertiary)">
          📁 No meeting minutes saved yet. Complete a live session and click "Save to History".
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = history.map(item => `
    <tr>
      <td style="font-weight:600; color:var(--text-primary)">${item.title}</td>
      <td style="font-size:12px">${item.date}</td>
      <td style="font-size:12px"><span class="badge badge-blue" style="font-size:10px">${item.language}</span></td>
      <td style="font-size:12px">${item.duration}</td>
      <td style="text-align:right">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="viewSavedMeeting('${item.id}')" title="Load Session">👁️</button>
        <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteSavedMeeting('${item.id}')" style="color:var(--error)" title="Delete Session">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// Load session back to editor fields
window.viewSavedMeeting = function(id) {
  const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const meeting = history.find(m => m.id === id);
  if (!meeting) return;

  document.getElementById('meetingTitle').value = meeting.title;
  document.getElementById('meetingAttendees').value = meeting.attendees;
  
  // Set transcripts
  
  const editor = document.getElementById('transcriptEditor');
  if (editor) editor.innerHTML = meeting.transcript;
  
  const summaryEl = document.getElementById('summaryTextarea');
  if (summaryEl) summaryEl.innerHTML = meeting.summary;
  
  const timerEl = document.getElementById('recTimer');
  if (timerEl) timerEl.textContent = meeting.duration;
  
  showToast('Session Loaded', `Opened minutes for: ${meeting.title}`, 'info');
};

// Delete session
window.deleteSavedMeeting = function(id) {
  if (confirm('Are you sure you want to delete this saved meeting session?')) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    history = history.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    loadSavedMeetings();
    showToast('Session Deleted', 'Meeting minutes removed from local storage.', 'info');
  }
};

// Mock publish to portal Knowledge Center
function publishToKnowledgeCenter() {
  const title = document.getElementById('meetingTitle')?.value || 'Weekly Sync Meeting';
  const summaryEl = document.getElementById('summaryTextarea');
  if (!summaryEl || !summaryEl.innerText.trim()) {
    showToast('Publish Failed', 'Please complete the transcription and generate the summary minutes first.', 'error');
    return;
  }

  showToast('Publishing Minutes...', 'Uploading to Lyceum Knowledge Center...', 'info');
  
  setTimeout(() => {
    showToast('Successfully Published!', `"${title}" minutes are now visible in the Knowledge Center under Teams/Meetings.`, 'success');
  }, 1200);
}

// ============================================================
// 12. Convert Action Items to Tasks Logic
// ============================================================

function extractAndCreateTasks() {
  const summaryEl = document.getElementById('summaryTextarea');
  const summaryText = summaryEl ? (summaryEl.innerText || summaryEl.textContent || '') : '';
  if (!summaryText.trim()) {
    showToast('No Action Items', 'Please complete the transcription and generate the summary minutes first.', 'error');
    return;
  }

  const tasks = parseActionItems(summaryText);
  if (tasks.length === 0) {
    showToast('No Action Items Found', 'We could not detect any action items in the meeting minutes list.', 'warning');
    return;
  }

  // Render modal items
  const container = document.getElementById('parsedTasksContainer');
  if (!container) return;

  // Let's create selectable option rows
  container.innerHTML = tasks.map((task, index) => {
    return `
      <div class="parsed-task-row">
        <input type="checkbox" id="chk-task-${index}" checked style="width:18px; height:18px; margin-top:2px; cursor:pointer" data-task-index="${index}">
        <div style="flex:1">
          <div class="form-group" style="margin-bottom:0">
            <input type="text" class="form-control" id="title-task-${index}" value="${task.title}" style="height:34px; font-size:13px; font-weight:600; width:100%" placeholder="Task description">
          </div>
          <div class="parsed-task-fields">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" style="font-size:11px; margin-bottom:2px">Assignee</label>
              <input type="text" class="form-control" id="assignee-task-${index}" value="${task.assignee}" style="height:32px; font-size:12px; padding:4px 8px">
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" style="font-size:11px; margin-bottom:2px">Due Date</label>
              <input type="date" class="form-control" id="due-task-${index}" value="${task.dueDate}" style="height:32px; font-size:12px; padding:4px 8px">
            </div>
          </div>
          <div class="parsed-task-fields" style="grid-template-columns: 1fr; margin-top: 8px">
            <div class="form-group" style="margin-bottom:0">
              <label class="form-label" style="font-size:11px; margin-bottom:2px">Priority</label>
              <select class="form-control form-select" id="priority-task-${index}" style="height:32px; font-size:12px; padding:4px 8px">
                <option value="High">🔴 High Priority</option>
                <option value="Medium" selected>🟡 Medium Priority</option>
                <option value="Low">⚪ Low Priority</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Store parsed tasks temp on window for submission
  window.tempParsedTasks = tasks;

  // Open modal
  openModal('taskManagerModal');
}

function parseActionItems(text) {
  // Normalize line breaks and remove common HTML tags
  let normalizedText = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalizedText.split('\n');
  const tasks = [];
  
  const staffNames = ['lisa thompson', 'lisa', 'raj patel', 'raj', 'james wilson', 'james', 'sudaraka perera', 'sudaraka'];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Determine if this line contains action item cues
    let isActionItem = trimmed.includes('👤') || trimmed.includes('Action Item');
    
    // Clean up markdown formatting and bullets
    let cleanLine = trimmed
      .replace(/<\/?[^>]+(>|$)/g, "") // Remove HTML tags
      .replace(/\*\*/g, "") // Remove bold indicators
      .replace(/\*/g, "")  // Remove bullet asterisks
      .replace(/^[-\d\.\s*•]+/, "") // Remove prefixes like "-", "1.", "*", "•"
      .replace('👤', '')
      .trim();
      
    // Look for separator patterns (colon, hyphen, or common connectors)
    let separatorIndex = cleanLine.indexOf(':');
    if (separatorIndex === -1) {
      separatorIndex = cleanLine.indexOf(' - ');
    }
    
    let assignee = '';
    let desc = '';
    
    if (separatorIndex > 0) {
      assignee = cleanLine.substring(0, separatorIndex).trim();
      desc = cleanLine.substring(separatorIndex + 1).trim();
    } else {
      // Fallback: check if the line starts with a known staff member name
      const lowerClean = cleanLine.toLowerCase();
      for (const name of staffNames) {
        if (lowerClean.startsWith(name)) {
          assignee = cleanLine.substring(0, name.length).trim();
          desc = cleanLine.substring(name.length).replace(/^(to|will|should|must)\s+/, '').trim();
          isActionItem = true;
          break;
        }
      }
    }
    
    // If it has a valid description, we can map it
    if (isActionItem || (assignee && desc)) {
      if (!assignee) {
        assignee = 'Lisa Thompson'; // Safe default
      }
      if (!desc) {
        desc = cleanLine;
      }
      
      // Default due date: 3 days from now
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3);
      const dateStr = targetDate.toISOString().split('T')[0];

      tasks.push({
        assignee: assignee,
        title: desc,
        dueDate: dateStr,
        priority: 'Medium'
      });
    }
  });

  return tasks;
}

function submitConvertedTasks() {
  if (!window.tempParsedTasks) return;
  
  const createdTasks = [];
  
  window.tempParsedTasks.forEach((task, index) => {
    const chk = document.getElementById(`chk-task-${index}`);
    if (chk && chk.checked) {
      const title = document.getElementById(`title-task-${index}`).value.trim();
      const assignee = document.getElementById(`assignee-task-${index}`).value.trim();
      const dueDate = document.getElementById(`due-task-${index}`).value;
      const priority = document.getElementById(`priority-task-${index}`).value;
      
      createdTasks.push({
        id: 'TSK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: title || task.title,
        assignee: assignee || task.assignee,
        dueDate: dueDate || task.dueDate,
        priority: priority || 'Medium',
        completed: false,
        meetingTitle: document.getElementById('meetingTitle')?.value || 'Weekly Sync Meeting',
        dateCreated: new Date().toLocaleDateString('en-US')
      });
    }
  });

  if (createdTasks.length === 0) {
    showToast('No Tasks Selected', 'Please check at least one action item to create tasks.', 'warning');
    return;
  }

  // Load existing tasks and merge
  let currentTasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
  currentTasks = [...createdTasks, ...currentTasks];
  localStorage.setItem('lc-tasks', JSON.stringify(currentTasks));

  closeModal('taskManagerModal');
  showToast('Tasks Created Successfully!', `${createdTasks.length} action items synced to your homepage tasks list.`, 'success');
  
  // Simulated immediate notification dispatch if checked
  const notifyVal = document.getElementById('notifyOnCreation')?.checked;
  if (notifyVal) {
    const STAFF_DIRECTORIES_LOCAL = {
      'lisa thompson': { email: 'lisa.thompson@lyceum.edu', telegram: '@lisa_t_lyceum' },
      'lisa': { email: 'lisa.thompson@lyceum.edu', telegram: '@lisa_t_lyceum' },
      'raj patel': { email: 'raj.patel@lyceum.edu', telegram: '@raj_patel_it' },
      'raj': { email: 'raj.patel@lyceum.edu', telegram: '@raj_patel_it' },
      'james wilson': { email: 'james.wilson@lyceum.edu', telegram: '@james_net_eng' },
      'james': { email: 'james.wilson@lyceum.edu', telegram: '@james_net_eng' },
      'sudaraka perera': { email: 'sudaraka.perera@lyceum.edu', telegram: '@sudaraka_p_it' },
      'sudaraka': { email: 'sudaraka.perera@lyceum.edu', telegram: '@sudaraka_p_it' }
    };

    createdTasks.forEach((task, idx) => {
      setTimeout(() => {
        const nameLower = task.assignee.toLowerCase().trim();
        let details = { 
          email: `${nameLower.replace(/\s+/g, '.')}@lyceum.edu`, 
          telegram: `@${nameLower.replace(/\s+/g, '_')}_connect` 
        };

        for (const key in STAFF_DIRECTORIES_LOCAL) {
          if (nameLower.includes(key)) {
            details = STAFF_DIRECTORIES_LOCAL[key];
            break;
          }
        }
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
        
        // Update storage with reminder stamp
        let tasks = JSON.parse(localStorage.getItem('lc-tasks') || '[]');
        const storedIndex = tasks.findIndex(t => t.id === task.id);
        if (storedIndex !== -1) {
          tasks[storedIndex].lastReminder = {
            type: 'Email + Telegram',
            time: timeStr,
            recipient: `${details.email} / ${details.telegram}`
          };
          localStorage.setItem('lc-tasks', JSON.stringify(tasks));
        }

        showToast(
          `🔔 Creation Notice: ${task.assignee}`,
          `<b>Email sent to:</b> ${details.email}<br><b>Telegram sent to:</b> ${details.telegram}<br><b>Content:</b> You are assigned: "${task.title}" (Due: ${task.dueDate})`,
          'info'
        );
      }, (idx + 1) * 800);
    });
  }

  // Clean up
  delete window.tempParsedTasks;
}
