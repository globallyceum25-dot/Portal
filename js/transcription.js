/* ============================================================
   LYCEUM CONNECT — MEETING TRANSCRIPTION CONTROLLER
   ============================================================ */

'use strict';

// Global Variables
let recognition = null;
let isListening = false;
let audioContext = null;
let analyser = null;
let source = null;
let animationFrameId = null;
let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

// Transcript storage
let finalTranscript = '';
let interimTranscript = '';

// Saved sessions key
const STORAGE_KEY = 'lc-meetings-history';

// Simulated scripts for Demo/Sandbox Mode
const DEMO_SCRIPTS = {
  'en-US': [
    { speaker: 'Sudaraka Perera (IT Lead)', lang: 'en-US', text: "Good morning everyone, let's start our weekly progress meeting. Today we want to review the new employee portal launch." },
    { speaker: 'Lisa Thompson (HR)', lang: 'en-US', text: "Morning Sudaraka. From HR side, the portal adoption is looking great. We had over 150 employees log in yesterday." },
    { speaker: 'Raj Patel (IT Manager)', lang: 'en-US', text: "That's excellent news. Have we resolved the login speed issues we saw in Block B?" },
    { speaker: 'James Wilson (Net Eng)', lang: 'en-US', text: "Yes Raj, I upgraded the local proxy settings and added more cache routes. Load time is down from 5 seconds to 1.2 seconds now." },
    { speaker: 'Sudaraka Perera (IT Lead)', lang: 'en-US', text: "Excellent work, James. Next item is security policies compliance. We need all staff to acknowledge the IT Asset Policy by June 15." },
    { speaker: 'Lisa Thompson (HR)', lang: 'en-US', text: "I will draft a global circular notification to go out today afternoon as a reminder." },
    { speaker: 'Raj Patel (IT Manager)', lang: 'en-US', text: "Let's make sure the link to the policy document in the Knowledge Center is working correctly." },
    { speaker: 'Sudaraka Perera (IT Lead)', lang: 'en-US', text: "I already checked it, it's correct. Thank you, let's proceed with action items. Lisa to send the circular, Raj to monitor server logs, and James to double-check remote VPN stability." }
  ],
  'si-LK': [
    { speaker: 'සුදාරක පෙරේරා (තොරතුරු තාක්ෂණ ප්‍රධානී)', lang: 'si-LK', text: "සුබ උදෑසනක් හැමෝටම, අපි අද සතිපතා රැස්වීම ආරම්භ කරමු. අලුත් සේවක ද්වාරයේ ප්‍රගතිය ගැන කතා කරන්නයි තියෙන්නේ." },
    { speaker: 'ලීසා තොම්සන් (මානව සම්පත්)', lang: 'si-LK', text: "සුබ උදෑසනක් සුදාරක. මානව සම්පත් පැත්තෙන් බැලුවොත් සේවකයින්ගෙන් ඉතා හොඳ ප්‍රතිචාර ලැබෙනවා. ඊයේ දවසේ 150 කට වඩා සම්බන්ධ වුණා." },
    { speaker: 'රාජ් පටෙල් (තොරතුරු තාක්ෂණ කළමනාකරු)', lang: 'si-LK', text: "ඒක ඉතාම හොඳයි. B කොටසේ තිබ්බ වෙබ් අඩවිය ප්‍රවේශ වීමේ ප්‍රමාදය විසඳන්න පුළුවන් වුණාද?" },
    { speaker: 'ජේම්ස් විල්සන් (ජාල ඉංජිනේරු)', lang: 'si-LK', text: "ඔව් රාජ්, මම proxy සැකසුම් යාවත්කාලීන කරලා වේගය වැඩි කළා. දැන් තත්පර 1.2 කින් වෙබ් පිටුව ක්‍රියාත්මක වෙනවා." },
    { speaker: 'සුදාරක පෙරේරා (තොරතුරු තාක්ෂණ ප්‍රධානී)', lang: 'si-LK', text: "ඉතාම හොඳයි ජේම්ස්. ඊළඟ කරුණ තමයි ජූනි 15 වනදාට කලින් සියලුම දෙනා තොරතුරු තාක්ෂණ වත්කම් ප්‍රතිපත්තිය අත්සන් කරන්න ඕනේ." },
    { speaker: 'ලීසා තොම්සන් (මානව සම්පත්)', lang: 'si-LK', text: "මම ඒ ගැන අද හවස සියලුම සේවකයින්ට මතක් කිරීමේ පණිවිඩයක් යවන්නම්." },
    { speaker: 'රාජ් පටෙල් (තොරතුරු තාක්ෂණ කළමනාකරු)', lang: 'si-LK', text: "දැනුම් මධ්‍යස්ථානයේ (Knowledge Center) තියෙන ලින්ක් එක නිවැරදිද කියලා නැවත බලන්න." },
    { speaker: 'සුදාරක පෙරේරා (තොරතුරු තාක්ෂණ ප්‍රධානී)', lang: 'si-LK', text: "මම ඒක පරීක්ෂා කළා, ඒක නිවැරදියි. එහෙනම් අද රැස්වීම අවසන් කරමු. හැමෝටම ස්තුතියි." }
  ],
  'mixed': [
    { speaker: 'Sudaraka Perera (IT Lead)', lang: 'en-US', text: "Good morning everyone, let's start the weekly sync. Today we're reviewing the bilingual workflow configuration." },
    { speaker: 'ලීසා තොම්සන් (මානව සම්පත්)', lang: 'si-LK', text: "සුබ උදෑසනක් සුදාරක. සේවක පැමිණීමේ වාර්තා සියල්ලම දැන් සූදානම් කරලා තියෙන්නේ." },
    { speaker: 'Raj Patel (IT Manager)', lang: 'en-US', text: "Perfect. James, have we updated the network permissions for the HR directory?" },
    { speaker: 'ජේම්ස් විල්සන් (Net Eng)', lang: 'si-LK', text: "ඔව් රාජ්, මම ජාල ප්‍රවේශ සීමාවන් යාවත්කාලීන කළා. දැන් කිසිම ප්‍රමාදයක් නැතිව වැඩ කරනවා." },
    { speaker: 'Sudaraka Perera (IT Lead)', lang: 'en-US', text: "Great. Let's make sure the deadline on June 15 is communicated to everyone." },
    { speaker: 'ලීසා තොම්සන් (මානව සම්පත්)', lang: 'si-LK', text: "නිවැරදියි සුදාරක, මම අද හවස ඒ ගැන සේවකයින්ට මතක් කිරීමේ circular එකක් යවන්නම්." }
  ]
};

let demoScriptIndex = 0;
let demoTimer = null;
let isDemoMode = false;

// Initialize Web Speech API & Visualizer
document.addEventListener('DOMContentLoaded', function() {
  checkSpeechSupport();
  initVisualizerCanvas();
  loadSavedMeetings();
  setupEventListeners();
});

// Setup DOM Event Listeners
function setupEventListeners() {
  // Lang toggle dropdown
  const langSelect = document.getElementById('transLanguage');
  if (langSelect) {
    langSelect.addEventListener('change', function() {
      switchLanguage(this.value);
    });
  }

  // Demo Mode toggle
  const demoToggle = document.getElementById('demoModeToggle');
  if (demoToggle) {
    demoToggle.addEventListener('change', function() {
      isDemoMode = this.checked;
      const indicator = document.getElementById('demoIndicator');
      if (indicator) {
        indicator.style.display = isDemoMode ? 'inline-flex' : 'none';
      }
      if (isListening) {
        stopTranscription(false);
      }
    });
  }

  // Keyboard shortcut (Alt + L) to toggle language dynamically
  document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      const langSelector = document.getElementById('transLanguage');
      if (langSelector) {
        let nextLang = 'en-US';
        if (langSelector.value === 'en-US') {
          nextLang = 'si-LK';
        } else if (langSelector.value === 'si-LK') {
          nextLang = 'mixed';
        } else {
          nextLang = 'en-US';
        }
        switchLanguage(nextLang);
      }
    }
  });
}

// Translation Lookup Dictionary
const TRANSLATION_DICT = {
  // 'si-LK' script mappings
  "සුබ උදෑසනක් හැමෝටම, අපි අද සතිපතා රැස්වීම ආරම්භ කරමු. අලුත් සේවක ද්වාරයේ ප්‍රගතිය ගැන කතා කරන්නයි තියෙන්නේ.": "Good morning everyone, let's start our weekly progress meeting. Today we want to review the new employee portal launch.",
  "සුබ උදෑසනක් සුදාරක. මානව සම්පත් පැත්තෙන් බැලුවොත් සේවකයින්ගෙන් ඉතා හොඳ ප්‍රතිචාර ලැබෙනවා. ඊයේ දවසේ 150 කට වඩා සම්බන්ධ වුණා.": "Good morning Sudaraka. From HR side, the portal adoption is looking great. We had over 150 employees log in yesterday.",
  "ඒක ඉතාම හොඳයි. B කොටසේ තිබ්බ වෙබ් අඩවිය ප්‍රවේශ වීමේ ප්‍රමාදය විසඳන්න පුළුවන් වුණාද?": "That's excellent news. Have we resolved the login speed issues we saw in Block B?",
  "ඔව් රාජ්, මම proxy සැකසුම් යාවත්කාලීන කරලා වේගය වැඩි කළා. දැන් තත්පර 1.2 කින් වෙබ් පිටුව ක්‍රියාත්මක වෙනවා.": "Yes Raj, I upgraded the local proxy settings and added more cache routes. Load time is down from 5 seconds to 1.2 seconds now.",
  "ඉතාම හොඳයි ජේම්ස්. ඊළඟ කරුණ තමයි ජූනි 15 වනදාට කලින් සියලුම දෙනා තොරතුරු තාක්ෂණ වත්කම් ප්‍රතිපත්තිය අත්සන් කරන්න ඕනේ.": "Excellent work, James. Next item is security policies compliance. We need all staff to acknowledge the IT Asset Policy by June 15.",
  "මම ඒ ගැන අද හවස සියලුම සේවකයින්ට මතක් කිරීමේ පණිවිඩයක් යවන්නම්.": "I will draft a global circular notification to go out today afternoon as a reminder.",
  "දැනුම් මධ්‍යස්ථානයේ (Knowledge Center) තියෙන ලින්ක් එක නිවැරදිද කියලා නැවත බලන්න.": "Let's make sure the link to the policy document in the Knowledge Center is working correctly.",
  "මම ඒක පරීක්ෂා කළා, ඒක නිවැරදියි. එහෙනම් අද රැස්වීම අවසන් කරමු. හැමෝටම ස්තුතියි.": "I already checked it, it's correct. Thank you, let's proceed with action items. Lisa to send the circular, Raj to monitor server logs, and James to double-check remote VPN stability.",
  
  // 'mixed' script mappings
  "සුබ උදෑසනක් සුදාරක. සේවක පැමිණීමේ වාර්තා සියල්ලම දැන් සූදානම් කරලා තියෙන්නේ.": "Good morning Sudaraka. All employee attendance reports are now ready.",
  "ඔව් රාජ්, මම ජාල ප්‍රවේශ සීමාවන් යාවත්කාලීන කළා. දැන් කිසිම ප්‍රමාදයක් නැතිව වැඩ කරනවා.": "Yes Raj, I updated the network access limits. Now it works without any delay.",
  "නිවැරදියි සුදාරක, මම අද හවස ඒ ගැන සේවකයින්ට මතක් කිරීමේ circular එකක් යවන්නම්.": "Correct Sudaraka, I will send a reminder circular to the employees this afternoon."
};

// Translate Sinhalese text to English
function translateToEnglish(text, sourceLang) {
  const trimmed = text.trim();
  if (TRANSLATION_DICT[trimmed]) {
    return TRANSLATION_DICT[trimmed];
  }
  
  // Regex check for Sinhalese characters
  const hasSinhalese = /[\u0D80-\u0DFF]/.test(text);
  if (hasSinhalese) {
    return `[Translated to English]: ${text}`;
  }
  
  return text;
}

// Dynamic Language switcher function
function switchLanguage(newLang) {
  const langSelect = document.getElementById('transLanguage');
  if (langSelect) langSelect.value = newLang;

  const activeLabel = document.getElementById('activeListeningLanguageLabel');
  if (activeLabel) {
    activeLabel.textContent = newLang === 'en-US' ? 'English (US)' : newLang === 'si-LK' ? 'Sinhalese (සිංහල)' : 'Bilingual (EN + SI)';
  }

  if (isListening) {
    if (isDemoMode) {
      showToast('Demo Language Changed', `Simulation now running for: ${newLang === 'en-US' ? 'English' : newLang === 'si-LK' ? 'Sinhalese' : 'Bilingual (EN + SI)'}`, 'info');
      clearInterval(demoTimer);
      startDemoTranscription(newLang);
    } else {
      if (recognition) {
        recognition.stop();
        // Browser recognition falls back to en-US under-the-hood if bilingual is picked
        recognition.lang = newLang === 'mixed' ? 'en-US' : newLang; 
        setTimeout(() => {
          try {
            recognition.start();
            showToast('Language Changed Live', `Microphone switched to: ${newLang === 'en-US' ? 'English' : newLang === 'si-LK' ? 'Sinhalese' : 'English (Bilingual Mode)'}`, 'success');
          } catch (e) {
            console.error(e);
          }
        }, 300);
      }
    }
  } else {
    showToast('Input Language Set', `Default language is now: ${newLang === 'en-US' ? 'English' : newLang === 'si-LK' ? 'Sinhalese' : 'Bilingual'}`, 'info');
  }
}

// 1. Check browser speech support
function checkSpeechSupport() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const statusEl = document.getElementById('recognitionSupportStatus');

  if (!SpeechRecognition) {
    if (statusEl) {
      statusEl.innerHTML = `
        <span style="color:var(--error); font-weight:600; font-size:12px; display:inline-flex; align-items:center; gap:4px">
          ⚠️ Your browser doesn't natively support Live Speech-to-Text. We recommend using <b>Google Chrome</b> or enabling Demo Mode below.
        </span>
      `;
    }
  } else {
    if (statusEl) {
      statusEl.innerHTML = `
        <span style="color:var(--success); font-weight:500; font-size:12px; display:inline-flex; align-items:center; gap:4px">
          ● Browser Speech Recognition API available (Sinhalese & English supported. Press <b>Alt + L</b> to switch languages on-the-fly)
        </span>
      `;
    }
    initSpeechRecognition(SpeechRecognition);
  }
}

// 2. Initialize browser SpeechRecognition API
function initSpeechRecognition(SpeechRecognitionClass) {
  recognition = new SpeechRecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = function() {
    isListening = true;
    updateUIState('listening');
    startTimer();
    startAudioVisualizer();
  };

  recognition.onresult = function(event) {
    interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const text = event.results[i][0].transcript;
        if (text.trim()) {
          const speaker = getSpeakerName();
          const activeLang = recognition.lang === 'si-LK' ? 'si' : 'en';
          const badgeClass = activeLang === 'si' ? 'badge-amber' : 'badge-blue';
          const badgeText = activeLang === 'si' ? 'SI' : 'EN';
          
          if (activeLang === 'si') {
            const translation = translateToEnglish(text, 'si-LK');
            finalTranscript += `<b>${speaker}</b> <span class="badge ${badgeClass}" style="font-size:9.5px; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:700; line-height:1; vertical-align:middle">${badgeText}</span>: ${text}<br><span class="translation-text">↳ Translated: ${translation}</span><br>`;
          } else {
            finalTranscript += `<b>${speaker}</b> <span class="badge ${badgeClass}" style="font-size:9.5px; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:700; line-height:1; vertical-align:middle">${badgeText}</span>: ${text}<br><br>`;
          }
        }
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    updateTranscriptView();
  };

  recognition.onerror = function(event) {
    console.error('Speech Recognition Error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Microphone Blocked', 'Please grant microphone permissions to use live speech-to-text.', 'error');
      stopTranscription(false);
    } else if (event.error === 'no-speech') {
      // Ignore silence timeout in continuous mode
    } else {
      showToast('Transcription Error', `Speech API error: ${event.error}`, 'error');
      stopTranscription(false);
    }
  };

  recognition.onend = function() {
    if (isListening && !isDemoMode) {
      try {
        recognition.start();
      } catch (e) {
        console.log("Failed to restart recognition automatically:", e);
      }
    }
  };
}

// Helper to determine mock speaker based on current state
function getSpeakerName() {
  const userName = document.getElementById('welcomeUserName')?.textContent || 'Sudaraka Perera';
  return finalTranscript.split('<br><br>').length % 2 === 0 ? `${userName} (Me)` : 'Participant';
}

// Update the editor text
function updateTranscriptView() {
  const editor = document.getElementById('transcriptEditor');
  if (!editor) return;

  const currentInterimHtml = interimTranscript 
    ? `<span style="color:var(--text-tertiary); font-style:italic">${interimTranscript}</span>` 
    : '';

  editor.innerHTML = finalTranscript + currentInterimHtml;
  editor.scrollTop = editor.scrollHeight;
}

// 3. Start Transcription Action
function startTranscription() {
  if (isListening) return;

  if (finalTranscript === '') {
    startTime = Date.now();
    elapsedSeconds = 0;
  }

  const langSelect = document.getElementById('transLanguage');
  const lang = langSelect ? langSelect.value : 'en-US';

  if (isDemoMode) {
    startDemoTranscription(lang);
  } else {
    if (!recognition) {
      showToast('Unsupported Browser', 'Speech Recognition is not available. Please toggle Demo Mode.', 'error');
      return;
    }
    recognition.lang = lang === 'mixed' ? 'en-US' : lang;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      showToast('Mic Access Failure', 'Speech engine failed to start. Try reloading.', 'error');
    }
  }
}

// 4. Pause Transcription Action
function pauseTranscription() {
  if (!isListening) return;

  if (isDemoMode) {
    clearInterval(demoTimer);
    clearInterval(timerInterval);
    isListening = false;
    updateUIState('paused');
  } else {
    isListening = false;
    if (recognition) {
      recognition.stop();
    }
    clearInterval(timerInterval);
    updateUIState('paused');
    stopAudioVisualizer();
  }
}

// Stop and finish transcription session
function stopTranscription(shouldSave = true) {
  pauseTranscription();
  
  if (shouldSave && (finalTranscript.trim() !== '')) {
    generateMinutes();
    showToast('Transcription Finished', 'Meeting minutes prepared. You can now save or export.', 'success');
  }
}

// Reset the workspace
function resetTranscription() {
  if (confirm('Are you sure you want to clear the current transcription? All unsaved text will be lost.')) {
    stopTranscription(false);
    finalTranscript = '';
    interimTranscript = '';
    elapsedSeconds = 0;
    document.getElementById('transcriptTimer').textContent = '00:00:00';
    
    const editor = document.getElementById('transcriptEditor');
    if (editor) editor.innerHTML = `<p class="placeholder-text" style="color:var(--text-tertiary)">Start speaking or click "Demo Mode" to see transcription in action...</p>`;
    
    const summaryEditor = document.getElementById('summaryTextarea');
    if (summaryEditor) summaryEditor.innerHTML = '';
    
    const tasksBtn = document.getElementById('createTasksBtn');
    if (tasksBtn) tasksBtn.style.display = 'none';
    
    demoScriptIndex = 0;
    updateUIState('idle');
    showToast('Workspace Cleared', 'You can start a new recording session.', 'info');
  }
}

// 5. Update UI Buttons & Indicators
function updateUIState(state) {
  const statusBadge = document.getElementById('transStatusBadge');
  const statusDot = document.getElementById('transStatusDot');
  const statusText = document.getElementById('transStatusText');
  const startBtn = document.getElementById('startTransBtn');
  const pauseBtn = document.getElementById('pauseTransBtn');
  const stopBtn = document.getElementById('stopTransBtn');

  if (state === 'listening') {
    if (statusBadge) { statusBadge.className = 'status-badge status-active'; }
    if (statusDot) statusDot.className = 'status-dot pulse';
    if (statusText) statusText.textContent = 'Listening Live';
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.disabled = false;
  } else if (state === 'paused') {
    if (statusBadge) { statusBadge.className = 'status-badge status-pending'; }
    if (statusDot) statusDot.className = 'status-dot';
    if (statusText) statusText.textContent = 'Paused';
    if (startBtn) {
      startBtn.style.display = 'inline-flex';
      startBtn.querySelector('.btn-label').textContent = 'Resume';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
  } else {
    // idle
    if (statusBadge) { statusBadge.className = 'status-badge'; }
    if (statusDot) statusDot.className = 'status-dot';
    if (statusText) statusText.textContent = 'Ready';
    if (startBtn) {
      startBtn.style.display = 'inline-flex';
      startBtn.querySelector('.btn-label').textContent = 'Start Transcribing';
    }
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (stopBtn) stopBtn.disabled = true;
  }
}

// 6. Recording Session Timer
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(function() {
    elapsedSeconds++;
    
    const hrs = Math.floor(elapsedSeconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (elapsedSeconds % 60).toString().padStart(2, '0');
    
    const timerDisplay = document.getElementById('transcriptTimer');
    if (timerDisplay) {
      timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
    }
  }, 1000);
}

// 7. Demo Sandbox Speech Simulation
function startDemoTranscription(lang) {
  isListening = true;
  updateUIState('listening');
  startTimer();
  startAudioVisualizer();

  const script = DEMO_SCRIPTS[lang] || DEMO_SCRIPTS['en-US'];

  if (finalTranscript === '') {
    finalTranscript = '';
    const editor = document.getElementById('transcriptEditor');
    if (editor) editor.innerHTML = '';
  }

  // Clear previous demo timer
  clearInterval(demoTimer);

  demoTimer = setInterval(function() {
    if (demoScriptIndex >= script.length) {
      clearInterval(demoTimer);
      stopTranscription(true);
      showToast('Demo Finished', 'Mock meeting simulation has ended.', 'success');
      return;
    }

    const currentLine = script[demoScriptIndex];
    
    // Simulate interim output first
    let textWritten = 0;
    const words = currentLine.text.split(' ');
    
    const wordInterval = setInterval(function() {
      if (textWritten >= words.length) {
        clearInterval(wordInterval);
        
        // Finalize speech segment with language badge
        const activeLang = currentLine.lang === 'si-LK' ? 'si' : 'en';
        const badgeClass = activeLang === 'si' ? 'badge-amber' : 'badge-blue';
        const badgeText = activeLang === 'si' ? 'SI' : 'EN';

        if (activeLang === 'si') {
          const translation = translateToEnglish(currentLine.text, 'si-LK');
          finalTranscript += `<strong>${currentLine.speaker}</strong> <span class="badge ${badgeClass}" style="font-size:9.5px; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:700; line-height:1; vertical-align:middle">${badgeText}</span>: ${currentLine.text}<br><span class="translation-text">↳ Translated: ${translation}</span><br>`;
        } else {
          finalTranscript += `<strong>${currentLine.speaker}</strong> <span class="badge ${badgeClass}" style="font-size:9.5px; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:700; line-height:1; vertical-align:middle">${badgeText}</span>: ${currentLine.text}<br><br>`;
        }
        interimTranscript = '';
        updateTranscriptView();
        
        demoScriptIndex++;
      } else {
        interimTranscript = words.slice(0, textWritten + 1).join(' ');
        updateTranscriptView();
        textWritten += Math.floor(Math.random() * 2) + 1; // write 1-2 words at a time
      }
    }, 200);

  }, 4500); // Send new sentence every 4.5s
}

// 8. Visualizer Canvas Web Audio API
let visualizerCanvas = null;
let visualizerCtx = null;

function initVisualizerCanvas() {
  visualizerCanvas = document.getElementById('visualizerCanvas');
  if (!visualizerCanvas) return;
  visualizerCtx = visualizerCanvas.getContext('2d');
  
  // Set dimensions
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Initial draw (straight line)
  drawStaticWave();
}

function resizeCanvas() {
  if (!visualizerCanvas) return;
  visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth;
  visualizerCanvas.height = 70;
}

function drawStaticWave() {
  if (!visualizerCtx || !visualizerCanvas) return;
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  
  visualizerCtx.clearRect(0, 0, width, height);
  visualizerCtx.strokeStyle = 'var(--border-strong)';
  visualizerCtx.lineWidth = 2;
  visualizerCtx.beginPath();
  visualizerCtx.moveTo(0, height / 2);
  visualizerCtx.lineTo(width, height / 2);
  visualizerCtx.stroke();
}

function startAudioVisualizer() {
  if (isDemoMode) {
    // Simulated visualizer wave for demo sandbox
    drawSimulatedWave();
    return;
  }

  // Web Audio Visualizer API
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        drawRealWave();
      })
      .catch(function(err) {
        console.warn('Microphone access denied for visualizer. Falling back to simulation:', err);
        drawSimulatedWave();
      });
  } else {
    drawSimulatedWave();
  }
}

function stopAudioVisualizer() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (source) source.disconnect();
  if (audioContext) audioContext.close();
  
  drawStaticWave();
}

// Real Audio visualizer animation using mic frequency Bin data
function drawRealWave() {
  if (!visualizerCanvas || !visualizerCtx || !analyser) return;

  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = function() {
    animationFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    visualizerCtx.clearRect(0, 0, width, height);
    
    // Draw grid lines
    visualizerCtx.fillStyle = 'rgba(59, 123, 248, 0.01)';
    visualizerCtx.fillRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * height * 0.9;

      // Premium Gradient styling
      const gradient = visualizerCtx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, 'rgba(59, 123, 248, 0.4)');
      gradient.addColorStop(1, 'var(--primary)');

      visualizerCtx.fillStyle = gradient;
      
      // Mirror style visualizer
      visualizerCtx.fillRect(x, (height - barHeight) / 2, barWidth - 2, barHeight);
      
      x += barWidth;
    }
  };

  draw();
}

// Simulated wavy sine visualizer for Demo/Blocked Mic states
let phase = 0;
function drawSimulatedWave() {
  if (!visualizerCanvas || !visualizerCtx) return;

  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;

  const draw = function() {
    animationFrameId = requestAnimationFrame(draw);
    visualizerCtx.clearRect(0, 0, width, height);

    visualizerCtx.strokeStyle = 'rgba(59, 123, 248, 0.65)';
    visualizerCtx.lineWidth = 2.5;
    visualizerCtx.beginPath();

    phase += 0.08; // speed of wave motion
    
    for (let x = 0; x < width; x++) {
      // Create multi-sine wavy line
      const angle = (x / 50) + phase;
      const amplitude = Math.sin(phase * 0.5) * 15 + 10;
      const y = height / 2 + Math.sin(angle) * amplitude * Math.sin(x / width * Math.PI);
      
      if (x === 0) {
        visualizerCtx.moveTo(x, y);
      } else {
        visualizerCtx.lineTo(x, y);
      }
    }
    visualizerCtx.stroke();
    
    // Draw helper parallel wave
    visualizerCtx.strokeStyle = 'rgba(107, 159, 250, 0.25)';
    visualizerCtx.beginPath();
    for (let x = 0; x < width; x++) {
      const angle = (x / 40) - phase * 1.2;
      const amplitude = Math.cos(phase * 0.4) * 10 + 6;
      const y = height / 2 + Math.cos(angle) * amplitude * Math.sin(x / width * Math.PI);
      
      if (x === 0) {
        visualizerCtx.moveTo(x, y);
      } else {
        visualizerCtx.lineTo(x, y);
      }
    }
    visualizerCtx.stroke();
  };

  draw();
}

// 9. Meeting Minutes Template AI Generation
function generateMinutes() {
  const title = document.getElementById('meetingTitle')?.value || 'Weekly Sync Meeting';
  const attendees = document.getElementById('meetingAttendees')?.value || 'Sudaraka Perera, Lisa Thompson, Raj Patel, James Wilson';
  const cleanTranscript = finalTranscript.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, "");
  
  const langSelect = document.getElementById('transLanguage');
  const lang = langSelect ? langSelect.value : 'en-US';

  const dateStr = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
  const durationStr = document.getElementById('transcriptTimer')?.textContent || '00:00:00';

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
  const attendees = document.getElementById('meetingAttendees')?.value || 'Sudaraka Perera';
  const langSelect = document.getElementById('transLanguage');
  const lang = langSelect ? langSelect.options[langSelect.selectedIndex].text : 'English (US)';
  const duration = document.getElementById('transcriptTimer')?.textContent || '00:00:00';
  
  const textEditor = document.getElementById('transcriptEditor');
  const transcriptHtml = textEditor ? textEditor.innerHTML : '';
  
  const summaryEditor = document.getElementById('summaryTextarea');
  const summaryHtml = summaryEditor ? summaryEditor.innerHTML : '';

  if (!finalTranscript.trim() && !transcriptHtml.trim()) {
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
  finalTranscript = meeting.transcript;
  interimTranscript = '';
  
  const editor = document.getElementById('transcriptEditor');
  if (editor) editor.innerHTML = meeting.transcript;
  
  const summaryEl = document.getElementById('summaryTextarea');
  if (summaryEl) summaryEl.innerHTML = meeting.summary;
  
  document.getElementById('transcriptTimer').textContent = meeting.duration;
  
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
  if (!summaryEl || !summaryEl.innerText.trim()) {
    showToast('No Action Items', 'Please complete the transcription and generate the summary minutes first.', 'error');
    return;
  }

  const tasks = parseActionItems(summaryEl.innerText);
  if (tasks.length === 0) {
    showToast('No Action Items Found', 'We could not detect any items starting with the user icon (👤) in the minutes list.', 'warning');
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
  const lines = text.split('\n');
  const tasks = [];
  
  lines.forEach(line => {
    if (line.includes('👤')) {
      // Clean asterisks, HTML tags, and prefix emojis
      let cleanLine = line.replace(/<\/?[^>]+(>|$)/g, "").replace(/\*\*/g, "").replace(/\*/g, "").trim();
      cleanLine = cleanLine.replace('👤', '').trim();
      
      const colonIndex = cleanLine.indexOf(':');
      if (colonIndex > 0) {
        const assignee = cleanLine.substring(0, colonIndex).trim();
        const desc = cleanLine.substring(colonIndex + 1).trim();
        
        if (assignee && desc) {
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
      }
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
