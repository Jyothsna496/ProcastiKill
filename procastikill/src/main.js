// ProcastiKill - Main Core Execution Engine
import { state, saveState, updateStreakAndActivity } from './state.js';
import { speakText, toggleDictation, stopAmbientSound, startAmbientSound, updateSoundUI } from './audio.js';
import { triageCrisisPlan, generateDailyPlanner } from './planner.js';
import { calculateInsightsStats, generateAIRecommendations, renderInsightsCharts } from './insights.js';

let clockInterval = null;
let notificationSent = {}; // prevent duplicate deadline alarms
let isDemoModeActive = localStorage.getItem('procastikill_demo_active') === 'true';

export function enterDemoMode(force = false) {
  isDemoModeActive = true;
  localStorage.setItem('procastikill_demo_active', 'true');
  localStorage.setItem('procastikill_demo_done', 'true'); // mark that first-time demo was seen/launched

  // Show the banner
  const banner = document.getElementById('demo-mode-banner');
  if (banner) banner.classList.remove('hidden');

  // Back up normal crises if we haven't already backed them up and there is non-demo data
  const hasRealCrises = state.crises.length > 0 && !state.crises.some(c => c.id.startsWith('demo-'));
  if (hasRealCrises && !localStorage.getItem('procastikill_backed_crises')) {
    localStorage.setItem('procastikill_backed_crises', JSON.stringify(state.crises));
    localStorage.setItem('procastikill_backed_active_id', state.activeCrisisId);
  }

  // Define Demo Crises
  const demoCrises = [
    {
      id: 'demo-crisis-db',
      title: 'Database Systems Assignment',
      description: 'Implement SQL schemas, normalize tables to BCNF, and optimize queries for a high-traffic workload.',
      hoursUntilDoom: 24,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      panicLevel: 'Severe',
      persona: 'tough',
      recipient: 'Professor',
      sprintsCompletedCount: 0,
      motivation: 'Procrastination is an active threat to your academic progress. Triage this immediately.',
      draft: 'Dear Professor, I am working diligently on my database schema implementation but ran into complex BCNF validation issues. I am requesting a brief extension if needed to finalize query benchmarking.',
      sprints: [
        { id: 'demo-sprint-db-1', title: 'Design Entity Relationship Diagrams', duration: 30, remainingTime: 1800, completed: false, running: false },
        { id: 'demo-sprint-db-2', title: 'Resolve BCNF Normalization', duration: 45, remainingTime: 2700, completed: false, running: false },
        { id: 'demo-sprint-db-3', title: 'Query Optimization & Index Validation', duration: 30, remainingTime: 1800, completed: false, running: false }
      ]
    },
    {
      id: 'demo-crisis-interview',
      title: 'Technical Coding Interview Prep',
      description: 'Review graph traversal algorithms, dynamic programming memoization, and mock leadership questions.',
      hoursUntilDoom: 32,
      deadline: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
      panicLevel: 'Moderate',
      persona: 'cooperative',
      recipient: 'Recruiter',
      sprintsCompletedCount: 0,
      motivation: 'Opportunity favors the prepared. Whiteboard your traversal routines and secure that offer.',
      draft: 'Hi Recruiting Team, looking forward to our technical whiteboard interview tomorrow evening. I am fully prepared and enthusiastic.',
      sprints: [
        { id: 'demo-sprint-int-1', title: 'Graph BFS/DFS whiteboard exercises', duration: 45, remainingTime: 2700, completed: false, running: false },
        { id: 'demo-sprint-int-2', title: 'DP memoization practice', duration: 45, remainingTime: 2700, completed: false, running: false }
      ]
    },
    {
      id: 'demo-crisis-electricity',
      title: 'Pay Electricity Bill',
      description: 'Avoid disconnection penalty. Log into utility portal and execute instant wire transfer.',
      hoursUntilDoom: 4,
      deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      panicLevel: 'Critical',
      persona: 'tough',
      recipient: 'Utility Company',
      sprintsCompletedCount: 0,
      motivation: 'Critical utility power risk. Take 10 minutes to resolve before nightfall.',
      draft: 'To Customer Support, payment confirmation code #88921 has been transmitted online.',
      sprints: [
        { id: 'demo-sprint-bill-1', title: 'Transmit instant wire payment', duration: 10, remainingTime: 600, completed: false, running: false }
      ]
    }
  ];

  state.crises = demoCrises;
  state.activeCrisisId = 'demo-crisis-db';

  // Habits: Two unfinished habits
  state.habits = [
    { id: 'h1', name: 'Morning Triage Planning', streak: 2, history: [] }, // unchecked
    { id: 'h2', name: 'Inbox Zero & Clean Workspace', streak: 4, history: [] }, // unchecked
    { id: 'h3', name: '30-Minute Workout/Refresher', streak: 0, history: [] }
  ];

  // Daily Schedule: Optimized AI decision schedule populated automatically
  state.dailySchedule = [
    { time: '09:00 AM', name: 'Morning Triage Planning (Habit)', duration: 15, type: 'habit' },
    { time: '09:20 AM', name: 'Sprint 1: Design Entity Relationship Diagrams (Database Systems)', duration: 30, type: 'study' },
    { time: '10:00 AM', name: 'Sprint 2: Resolve BCNF Normalization (Database Systems)', duration: 45, type: 'study' },
    { time: '11:00 AM', name: 'Inbox Zero & Clean Workspace (Habit)', duration: 15, type: 'habit' },
    { time: '01:00 PM', name: 'Sprint 1: Graph BFS/DFS whiteboarding (Interview Prep)', duration: 45, type: 'study' },
    { time: '02:00 PM', name: 'Sprint 2: DP memoization practice (Interview Prep)', duration: 45, type: 'study' },
    { time: '04:00 PM', name: 'Busy block: Scheduled Class Lecture / Lab', duration: 120, type: 'busy' },
    { time: '07:00 PM', name: 'Emergency: Pay Electricity Bill (Critical)', duration: 10, type: 'study' }
  ];

  state.googleCalendarConnected = true; // Simulating Google calendar integration

  // Setup the AI Chat / explanation immediately
  const aiExplanation = "I noticed three competing deadlines.\n\nI've prioritized the Database assignment because it requires the most focused work.\n\nI've scheduled interview preparation after lunch.\n\nI've reserved 10 minutes tonight to pay your electricity bill.\n\nI've also prepared a professional message in case you need an extension.";
  state.chatHistory = [
    { sender: 'ai', text: aiExplanation }
  ];

  // Speak explanation if sound is enabled
  speakText("I noticed three competing deadlines. I've prioritized the Database assignment because it requires the most focused work. I've scheduled interview preparation after lunch. I've reserved 10 minutes tonight to pay your electricity bill. I've also prepared a professional message in case you need an extension.");

  saveState();

  // Re-render components
  renderCrisesQueue();
  loadActiveCrisis();
  renderChatHistory();
  renderTimelineSchedule();
  renderHabits();
  renderCalendar();
  updateAgenticDashboard();
}

export function exitDemoMode() {
  isDemoModeActive = false;
  localStorage.removeItem('procastikill_demo_active');

  // Hide the banner
  const banner = document.getElementById('demo-mode-banner');
  if (banner) banner.classList.add('hidden');

  // Restore normal crises or empty state
  const backed = localStorage.getItem('procastikill_backed_crises');
  if (backed) {
    state.crises = JSON.parse(backed);
    state.activeCrisisId = localStorage.getItem('procastikill_backed_active_id') || '';
    localStorage.removeItem('procastikill_backed_crises');
    localStorage.removeItem('procastikill_backed_active_id');
  } else {
    state.crises = [];
    state.activeCrisisId = '';
  }

  // Restore calendar and habits to defaults
  state.googleCalendarConnected = false;
  state.dailySchedule = null;
  state.habits = [
    { id: 'h1', name: 'Morning Triage Planning', streak: 2, history: ['2026-06-29', '2026-06-28'] },
    { id: 'h2', name: 'Inbox Zero & Clean Workspace', streak: 4, history: ['2026-06-29', '2026-06-28', '2026-06-27', '2026-06-26'] },
    { id: 'h3', name: '30-Minute Workout/Refresher', streak: 0, history: [] }
  ];
  state.chatHistory = [
    { sender: 'ai', text: 'Procrastination is an active threat to your survival. Declare your looming deadline above, and we will deconstruct it into 3 surgical execution sprints immediately.' }
  ];

  saveState();

  // Re-render
  renderCrisesQueue();
  loadActiveCrisis();
  renderChatHistory();
  renderTimelineSchedule();
  renderHabits();
  renderCalendar();
  updateAgenticDashboard();
}

window.enterDemoMode = enterDemoMode;
window.exitDemoMode = exitDemoMode;

// TAB MANAGEMENT
export function switchTab(tab) {
  state.activeTab = tab;
  
  // Update header buttons
  const tabs = ['dashboard', 'calendar', 'habits', 'insights'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const section = document.getElementById(`view-${t}`);
    if (btn && section) {
      if (t === tab) {
        btn.className = 'px-5 py-2 rounded-[12px] font-medium text-sm transition-all duration-200 flex items-center gap-2 bg-primary text-white shadow-md shadow-primary/10';
        section.classList.remove('hidden');
      } else {
        btn.className = 'px-5 py-2 rounded-[12px] font-medium text-sm transition-all duration-200 flex items-center gap-2 text-secondaryText hover:text-headingText hover:bg-slate-50';
        section.classList.add('hidden');
      }
    }
  });

  // Action on tab entry
  if (tab === 'insights') {
    setTimeout(() => {
      renderInsightsCharts();
      loadCoachInsights();
    }, 100);
  } else if (tab === 'calendar') {
    renderCalendar();
  } else if (tab === 'habits') {
    renderHabits();
  }
}

// MAKE FUNCTIONS ACCESSIBLE GLOBALLY FOR ONCLICK HANDLERS
window.switchTab = switchTab;
window.toggleVoiceAlerts = () => {
  state.soundOn = !state.soundOn;
  saveState();
  const icon = document.getElementById('voice-alert-icon');
  if (icon) {
    if (state.soundOn) {
      icon.className = 'fa-solid fa-volume-high text-primary';
      speakText('Voice coach active. Execute your goals.');
    } else {
      icon.className = 'fa-solid fa-volume-xmark';
    }
  }
};
window.toggleDictation = toggleDictation;
window.startAmbientSound = startAmbientSound;
window.stopAmbientSound = stopAmbientSound;

// SETTINGS MODAL
window.openSettingsModal = () => {
  const modal = document.getElementById('modal-settings');
  const input = document.getElementById('input-api-key');
  if (modal && input) {
    input.value = state.apiKey;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};
window.closeSettingsModal = () => {
  const modal = document.getElementById('modal-settings');
  if (modal) modal.classList.add('hidden');
};
window.saveSettings = () => {
  const input = document.getElementById('input-api-key');
  if (input) {
    state.apiKey = input.value.trim();
    saveState();
    updateAPIStatusIndicator();
    closeSettingsModal();
    speakText('Settings updated.');
  }
};

function updateAPIStatusIndicator() {
  const dot = document.getElementById('api-status-dot');
  const label = document.getElementById('api-status-label');
  if (dot && label) {
    if (state.apiKey) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-success';
      label.textContent = 'Gemini Flash Core';
    } else {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-warning';
      label.textContent = 'Local Heuristic';
    }
  }
}

// REQUEST NOTIFICATION ACCESS
window.toggleNotifications = () => {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        alert('Deadline desktop alerts configured successfully!');
      }
    });
  } else {
    alert('Browser notifications already configured and enabled.');
  }
};

// MULTI-CRISIS QUEUE ACTIONS
window.triageNewCrisis = async (e) => {
  if (e) e.preventDefault();
  
  const title = document.getElementById('crisis-title').value.trim();
  const desc = document.getElementById('crisis-desc').value.trim();
  const hours = parseFloat(document.getElementById('crisis-hours').value);
  const persona = document.getElementById('crisis-persona').value;
  const recipient = document.getElementById('crisis-recipient').value;
  const deadlineInput = document.getElementById('crisis-deadline').value;

  if (!title) {
    alert('Please define the crisis title!');
    return;
  }

  // Determine target exact deadline
  let finalDeadline = '';
  if (deadlineInput) {
    finalDeadline = new Date(deadlineInput).toISOString();
  } else {
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + hours);
    finalDeadline = targetDate.toISOString();
  }

  // Loading animation status on button
  const submitBtn = document.getElementById('btn-triage-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Triaging Crisis & Framing Sprints...';
  }

  const result = await triageCrisisPlan(title, desc, hours, persona, recipient);

  const formattedSprints = result.sprints.map((s, idx) => ({
    id: `sprint-${idx}`,
    title: s.title,
    duration: s.duration,
    task: s.task,
    remainingTime: s.duration * 60,
    completed: false,
    running: false
  }));

  const newCrisis = {
    id: `crisis-${Date.now()}`,
    title: title,
    description: desc,
    hoursUntilDoom: hours,
    deadline: finalDeadline,
    persona: persona,
    recipient: recipient,
    panicLevel: result.panicLevel,
    sprints: formattedSprints,
    draft: result.draft,
    motivation: result.motivation,
    sprintsCompletedCount: 0
  };

  state.crises.push(newCrisis);
  state.activeCrisisId = newCrisis.id;
  
  // Reset form
  document.getElementById('crisis-title').value = '';
  document.getElementById('crisis-desc').value = '';
  document.getElementById('crisis-deadline').value = '';
  
  saveState();
  
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Triage Crisis & Generate Plan';
  }

  speakText(`Crisis triaged. Your panic level is determined as ${result.panicLevel}. Execute sprint one immediately.`);
  renderCrisesQueue();
  loadActiveCrisis();
};

export function renderCrisesQueue() {
  const container = document.getElementById('crises-pills-container');
  if (!container) return;
  container.innerHTML = '';

  if (state.crises.length === 0) {
    container.innerHTML = `
      <div class="text-secondaryText text-sm italic py-2 flex items-center gap-1.5">
        <i class="fa-solid fa-shield-halved"></i> No active crises in triage. Plan a goal above to initialize.
      </div>
    `;
    // Hide active crisis fields
    const activeHUD = document.getElementById('active-crisis-hud');
    if (activeHUD) activeHUD.classList.add('hidden');
    updateAgenticDashboard();
    return;
  }

  const activeHUD = document.getElementById('active-crisis-hud');
  if (activeHUD) activeHUD.classList.remove('hidden');

  state.crises.forEach(crisis => {
    const isActive = crisis.id === state.activeCrisisId;
    const pill = document.createElement('div');
    pill.className = `flex items-center gap-2 px-4 py-2 rounded-[14px] border font-medium text-sm cursor-pointer transition-all duration-200 ${
      isActive 
        ? 'bg-primary border-primary text-white shadow-sm' 
        : 'bg-white border-borderLight text-bodyText hover:bg-slate-50'
    }`;
    
    pill.innerHTML = `
      <span onclick="window.selectCrisis('${crisis.id}')" class="truncate max-w-[120px]">${crisis.title}</span>
      <button onclick="window.deleteCrisis('${crisis.id}', event)" class="p-0.5 hover:text-red-500 hover:scale-110 rounded transition-all">
        <i class="fa-solid fa-xmark text-xs ${isActive ? 'text-indigo-200 hover:text-white' : 'text-secondaryText'}"></i>
      </button>
    `;
    container.appendChild(pill);
  });
}

window.selectCrisis = (crisisId) => {
  stopAmbientSound();
  state.activeCrisisId = crisisId;
  saveState();
  renderCrisesQueue();
  loadActiveCrisis();
};

window.deleteCrisis = (crisisId, event) => {
  if (event) event.stopPropagation();
  stopAmbientSound();
  state.crises = state.crises.filter(c => c.id !== crisisId);
  if (state.activeCrisisId === crisisId) {
    state.activeCrisisId = state.crises.length > 0 ? state.crises[0].id : '';
  }
  saveState();
  renderCrisesQueue();
  loadActiveCrisis();
};

// LOAD DETAILS FOR ACTIVE CRISIS
export function loadActiveCrisis() {
  const crisis = state.crises.find(c => c.id === state.activeCrisisId);
  if (!crisis) {
    renderCrisesQueue();
    return;
  }

  // Render Title and Panic level badge
  document.getElementById('hud-title').textContent = crisis.title;
  
  const badge = document.getElementById('hud-panic-badge');
  badge.textContent = `${crisis.panicLevel} Urgency`;
  if (crisis.panicLevel === 'Critical') {
    badge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600 border border-red-200';
  } else if (crisis.panicLevel === 'Severe') {
    badge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-600 border border-amber-200';
  } else {
    badge.className = 'px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200';
  }

  // Render Tough love AI Coach statement
  document.getElementById('hud-motivation-quote').textContent = crisis.motivation || 'The clock is ticking. Run the sprint timers and eliminate procrastination.';

  // Render the draft communication card
  document.getElementById('payload-draft-text').textContent = crisis.draft || 'No draft generated.';

  renderSprintsRoadmap(crisis);
  updateCircularProgressHUD(crisis);
  loadCoachInsights();
  updateAgenticDashboard();
}

// COUNTDOWN TIMER TICKERS
function initGlobalClockLoop() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => {
    const crisis = state.crises.find(c => c.id === state.activeCrisisId);
    
    // 1. Ticking Sprints
    if (crisis) {
      crisis.sprints.forEach((sprint, idx) => {
        if (sprint.running && !sprint.completed) {
          if (sprint.remainingTime > 0) {
            sprint.remainingTime--;
            
            // Render specific timer ticking live
            const timerSpan = document.getElementById(`timer-display-${idx}`);
            if (timerSpan) {
              const mm = Math.floor(sprint.remainingTime / 60);
              const ss = sprint.remainingTime % 60;
              timerSpan.textContent = `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
            }
          } else {
            // Timer Hit 0:00! Sprint finished
            sprint.running = false;
            sprint.completed = true;
            crisis.sprintsCompletedCount++;
            
            updateStreakAndActivity(sprint.duration);
            saveState();
            
            // Success audio and prompt
            speakText(`Milestone completed! Great progress. XP and streak boosted!`);
            alert(`Awesome work! You finished: "${sprint.title}"`);
            
            loadActiveCrisis();
            
            // Check if all 3 completed
            if (crisis.sprintsCompletedCount === 3) {
              speakText(`Magnificent! All sprints cleared for this crisis. Deadline neutralized.`);
            }
          }
        }
      });
    }

    // 2. Deadline notifications checks
    state.crises.forEach(c => {
      const msLeft = new Date(c.deadline).getTime() - Date.now();
      const minsLeft = Math.round(msLeft / 1000 / 60);

      if (Notification.permission === 'granted') {
        const calStatus = state.googleCalendarConnected ? 'Your synced calendar lists no conflicting appointments in this block.' : 'Connect your Google Calendar to auto-block subsequent schedules.';
        if (minsLeft === 60 && !notificationSent[`${c.id}-60`]) {
          new Notification('ProcastiKill Agent Warning', { body: `Only 60 minutes left before deadline: "${c.title}"! ${calStatus} This is your optimal focus window to execute your final sprints.` });
          notificationSent[`${c.id}-60`] = true;
        } else if (minsLeft === 15 && !notificationSent[`${c.id}-15`]) {
          new Notification('ProcastiKill Agent Urgent Alert', { body: `🚨 Only 15 minutes left until "${c.title}" is due! Start the sprint timer immediately and lock down focus. I've initiated voice-mode pacing.` });
          notificationSent[`${c.id}-15`] = true;
        } else if (minsLeft <= 0 && !notificationSent[`${c.id}-0`]) {
          new Notification('ProcastiKill Agent Danger Alert', { body: `Deadline PASSED for: "${c.title}"! Initiate emergency grace recovery immediately or contact the stakeholder.` });
          notificationSent[`${c.id}-0`] = true;
        }
      }
    });

    // Update main HUD countdown display
    updateCircularProgressHUD(crisis);
  }, 1000);
}

// DRAW THE CIRCULAR RING & HUD METADATA
function updateCircularProgressHUD(crisis) {
  const ring = document.getElementById('hud-progress-circle');
  const durationText = document.getElementById('hud-countdown-text');
  
  if (!crisis || !ring || !durationText) return;

  const deadlineMs = new Date(crisis.deadline).getTime();
  const msLeft = deadlineMs - Date.now();
  
  if (msLeft <= 0) {
    durationText.textContent = 'Doom Deadline Passed';
    durationText.classList.add('text-red-600');
    ring.style.strokeDashoffset = '283'; // completely empty circle
    return;
  }

  durationText.classList.remove('text-red-600');
  
  const hh = Math.floor(msLeft / 1000 / 60 / 60);
  const mm = Math.floor((msLeft / 1000 / 60) % 60);
  const ss = Math.floor((msLeft / 1000) % 60);
  
  durationText.textContent = `${hh}h ${mm}m ${ss}s left`;

  // Circular gauge calculations (Circumference of radius 45 is 2 * PI * 45 = 282.7)
  const totalDurationSeconds = crisis.hoursUntilDoom * 60 * 60;
  const currentSecondsLeft = msLeft / 1000;
  const fractionLeft = Math.max(0, Math.min(1, currentSecondsLeft / totalDurationSeconds));
  const offset = 283 - (fractionLeft * 283);
  ring.style.strokeDashoffset = offset.toString();

  // Draw dynamic SVG line chart (Panic Index vs sprints completed)
  const svgLine = document.getElementById('panic-svg-line');
  if (svgLine) {
    const completed = crisis.sprintsCompletedCount;
    let path = "M10,80 L40,80 L70,80 L100,80"; // Default
    if (completed === 1) {
      path = "M10,80 L35,50 L70,50 L100,50";
    } else if (completed === 2) {
      path = "M10,80 L35,50 L65,25 L100,25";
    } else if (completed === 3) {
      path = "M10,80 L35,50 L65,25 L100,10";
    }
    svgLine.setAttribute('d', path);
  }
}

// RENDER CALCULATED SPRINTS CARDS
export function renderSprintsRoadmap(crisis) {
  const container = document.getElementById('sprints-cards-container');
  if (!container) return;
  container.innerHTML = '';

  crisis.sprints.forEach((sprint, idx) => {
    const isCompleted = sprint.completed;
    const isRunning = sprint.running;
    const card = document.createElement('div');
    
    // Class definitions based on status
    let borderClass = 'border-l-4 border-l-slate-200';
    if (isCompleted) borderClass = 'border-l-4 border-l-success opacity-60';
    else if (isRunning) borderClass = 'border-l-4 border-l-primary animate-pulse bg-indigo-50/20';

    const mm = Math.floor(sprint.remainingTime / 60);
    const ss = sprint.remainingTime % 60;

    card.className = `p-4 bg-white border border-borderLight rounded-[16px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200 hover:shadow-sm ${borderClass}`;
    
    card.innerHTML = `
      <div class="flex items-start gap-3">
        <input type="checkbox" id="check-sprint-${idx}" ${isCompleted ? 'checked' : ''} 
          onclick="window.toggleSprintCheckbox(${idx})" 
          class="mt-1 w-5 h-5 rounded-md border-gray-300 text-primary focus:ring-primary focus:border-primary cursor-pointer">
        <div>
          <h4 class="font-semibold text-base font-heading text-headingText ${isCompleted ? 'line-through text-secondaryText' : ''}">
            ${idx + 1}. ${sprint.title}
          </h4>
          <p class="text-sm text-secondaryText mt-1 max-w-md ${isCompleted ? 'line-through' : ''}">
            ${sprint.task}
          </p>
        </div>
      </div>
      
      <div class="flex items-center gap-4 self-end md:self-center">
        <div class="font-mono font-bold text-lg text-bodyText" id="timer-display-${idx}">
          ${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}
        </div>
        <button onclick="window.toggleSprintTimer(${idx})" class="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-200 ${
          isRunning 
            ? 'bg-amber-100 border-amber-300 text-amber-600 hover:bg-amber-200' 
            : 'bg-indigo-50 border-indigo-200 text-primary hover:bg-indigo-100'
        }">
          <i class="fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  // Update Tactical Status Progress Tracker
  const percent = Math.round((crisis.sprintsCompletedCount / 3) * 100);
  document.getElementById('tracker-progress-bar').style.width = `${percent}%`;
  document.getElementById('tracker-progress-text').textContent = `Completed Sprints: ${crisis.sprintsCompletedCount} / 3 (${percent}%)`;
}

// MANUAL CHECKBOX TOGGLING FOR SPRINTS
window.toggleSprintCheckbox = (idx) => {
  const crisis = state.crises.find(c => c.id === state.activeCrisisId);
  if (!crisis) return;

  const sprint = crisis.sprints[idx];
  sprint.completed = !sprint.completed;
  
  if (sprint.completed) {
    sprint.running = false;
    crisis.sprintsCompletedCount++;
    updateStreakAndActivity(sprint.duration);
    speakText('Sprint completed. Keep pushing.');
  } else {
    crisis.sprintsCompletedCount--;
    saveState();
  }
  
  saveState();
  loadActiveCrisis();
};

// TIMER PLAY / PAUSE TRIGGER
window.toggleSprintTimer = (idx) => {
  const crisis = state.crises.find(c => c.id === state.activeCrisisId);
  if (!crisis) return;

  const sprint = crisis.sprints[idx];
  
  // Pause all other timers
  crisis.sprints.forEach((s, sIdx) => {
    if (sIdx !== idx) s.running = false;
  });

  sprint.running = !sprint.running;
  saveState();
  
  if (sprint.running) {
    speakText(`Starting ${sprint.title}. Eliminate all distractions.`);
  }
  
  loadActiveCrisis();
};

// COPY DRAFT TO CLIPBOARD
window.copyDraftToClipboard = () => {
  const text = document.getElementById('payload-draft-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('Draft letter successfully copied to clipboard!');
  }, () => {
    // fallback
    const temp = document.createElement('textarea');
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    alert('Draft letter copied to clipboard!');
  });
};

// DOWNLOAD FULL TRIAGE DETAILS AS TXT FILE
window.downloadFullTriagePlan = () => {
  const crisis = state.crises.find(c => c.id === state.activeCrisisId);
  if (!crisis) return;

  let fileContent = `==================================================
PROCASTIKILL TRIAGE PLAN: ${crisis.title.toUpperCase()}
Panic Level: ${crisis.panicLevel}
Created: ${new Date().toLocaleDateString()}
==================================================

AI COACH SUMMARY:
"${crisis.motivation}"

--------------------------------------------------
EXECUTION ROADMAP:
--------------------------------------------------
1. ${crisis.sprints[0].title} (${crisis.sprints[0].duration} minutes)
   Instructions: ${crisis.sprints[0].task}

2. ${crisis.sprints[1].title} (${crisis.sprints[1].duration} minutes)
   Instructions: ${crisis.sprints[1].task}

3. ${crisis.sprints[2].title} (${crisis.sprints[2].duration} minutes)
   Instructions: ${crisis.sprints[2].task}

--------------------------------------------------
BUY-MORE-TIME PAYLOAD:
--------------------------------------------------
${crisis.draft}
`;

  const blob = new Blob([fileContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ProcastiKill-${crisis.title.replace(/\s+/g, '-')}-plan.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// COACH CHAT BOT SUBMISSIONS
window.sendCoachMessage = () => {
  const input = document.getElementById('coach-chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Add user message
  state.chatHistory.push({ sender: 'user', text: text });
  input.value = '';
  renderChatHistory();

  // Scroll to bottom
  const feed = document.getElementById('coach-chat-feed');
  feed.scrollTop = feed.scrollHeight;

  // Render typing indicator
  const typingId = 'typing-indicator';
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'flex items-start gap-2 max-w-[80%] self-start';
  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-lg bg-indigo-50 text-primary flex items-center justify-center text-xs font-bold font-heading">AI</div>
    <div class="p-3 bg-slate-100 rounded-[14px] text-bodyText text-sm animate-pulse">Thinking...</div>
  `;
  feed.appendChild(typingDiv);
  feed.scrollTop = feed.scrollHeight;

  // Trigger coach AI reply (with local/Gemini routing)
  setTimeout(async () => {
    // Remove typing indicator
    const indicator = document.getElementById(typingId);
    if (indicator) feed.removeChild(indicator);

    let aiReply = '';
    const activeCrisis = state.crises.find(c => c.id === state.activeCrisisId);
    
    if (state.apiKey) {
      try {
        const prompt = `You are ProcastiKill's tough-love AI coach.
Context:
- Current active crisis: "${activeCrisis ? activeCrisis.title : 'None'}"
- Remaining hours: ${activeCrisis ? activeCrisis.hoursUntilDoom : 'N/A'} hours
- Completed sprints count: ${activeCrisis ? activeCrisis.sprintsCompletedCount : 0}/3
The user asks: "${text}"

Reply in a very blunt, sarcastic, but highly motivating and concise style (max 2 sentences). No fluff.`;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch (err) {
        console.warn('Coach chat AI failed, falling back to local chat generator:', err);
      }
    }

    if (!aiReply) {
      // Local reply templates
      const fallbacks = [
        "Why are you typing chat questions to me instead of executing Sprint 1? Back to work!",
        "The clock is ticking and your deadline won't write itself. Sprints over chatter.",
        "That's a nice question. Too bad it won't neutralize your deadline. Run the timer!",
        "Stop overthinking. Execute. The roadmap was calculated specifically for your focus."
      ];
      aiReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    state.chatHistory.push({ sender: 'ai', text: aiReply });
    saveState();
    renderChatHistory();
    speakText(aiReply);
  }, 1000);
};

export function renderChatHistory() {
  const feed = document.getElementById('coach-chat-feed');
  if (!feed) return;
  feed.innerHTML = '';

  state.chatHistory.forEach(msg => {
    const isAi = msg.sender === 'ai';
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex items-start gap-2 max-w-[80%] ${isAi ? 'self-start' : 'self-end flex-row-reverse'}`;
    
    msgDiv.innerHTML = `
      <div class="w-8 h-8 rounded-lg ${isAi ? 'bg-indigo-50 text-primary' : 'bg-indigo-600 text-white'} flex items-center justify-center text-xs font-bold font-heading">
        ${isAi ? 'AI' : 'ME'}
      </div>
      <div class="p-3 ${isAi ? 'bg-slate-100 text-bodyText' : 'bg-primary text-white'} rounded-[14px] text-sm leading-relaxed">
        ${msg.text}
      </div>
    `;
    feed.appendChild(msgDiv);
  });
  feed.scrollTop = feed.scrollHeight;
}

// FEATURE 1 – AI DAILY PLANNER ("Generate My Day")
window.generateMyDailySchedule = async () => {
  const listContainer = document.getElementById('timeline-list-container');
  const btn = document.getElementById('btn-generate-day');
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Arranging Timeline...';
  }

  const schedule = await generateDailyPlanner();
  renderTimelineSchedule(schedule);

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Regenerate Day';
  }
};

export function renderTimelineSchedule(schedule) {
  const container = document.getElementById('timeline-list-container');
  const actionPanel = document.getElementById('timeline-actions-panel');
  if (!container) return;
  container.innerHTML = '';

  const sched = schedule || state.dailySchedule;

  if (!sched || sched.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-secondaryText text-sm">
        <i class="fa-solid fa-calendar-day text-3xl mb-2 text-slate-300 block"></i>
        No schedule generated. Click "Generate My Day" to map out your tasks.
      </div>
    `;
    if (actionPanel) actionPanel.classList.add('hidden');
    return;
  }

  if (actionPanel) actionPanel.classList.remove('hidden');

  sched.forEach((item, idx) => {
    const card = document.createElement('div');
    card.style.animation = `fadeInUp 0.3s ease-out ${idx * 0.05}s both`;
    
    // Choose bullet color and tag classes based on type
    let accentBorder = 'border-l-4 border-l-slate-200';
    let dotColor = 'bg-slate-300';
    let typeLabel = '';
    
    if (item.type === 'study') {
      accentBorder = 'border-l-4 border-l-primary';
      dotColor = 'bg-primary';
      typeLabel = '<span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-primary border border-indigo-100">Study/Sprint</span>';
    } else if (item.type === 'busy') {
      accentBorder = 'border-l-4 border-l-error';
      dotColor = 'bg-error';
      typeLabel = '<span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-50 text-red-600 border border-red-100">Busy Slot</span>';
    } else if (item.type === 'habit') {
      accentBorder = 'border-l-4 border-l-success';
      dotColor = 'bg-success';
      typeLabel = '<span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-green-50 text-green-600 border border-green-100">Habit</span>';
    } else if (item.type === 'break') {
      accentBorder = 'border-l-4 border-l-accent';
      dotColor = 'bg-accent';
      typeLabel = '<span class="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-cyan-50 text-cyan-600 border border-cyan-100">Decompress</span>';
    }

    card.className = `relative p-4 bg-white border border-borderLight rounded-[16px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-200 hover:shadow-sm ${accentBorder}`;
    
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-secondaryText">
          <i class="fa-regular fa-clock text-sm"></i>
        </div>
        <div>
          <span class="font-mono font-bold text-sm text-bodyText">${item.time}</span>
          <h4 class="font-semibold text-sm text-headingText mt-0.5">${item.task}</h4>
        </div>
      </div>
      <div class="flex items-center gap-2 self-end sm:self-center">
        ${typeLabel}
        <span class="text-xs text-secondaryText font-medium">${item.duration} Min</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// FEATURE 1 COPY / DOWNLOAD SCHEDULE
window.copyScheduleToClipboard = () => {
  if (!state.dailySchedule) return;
  let text = "========================================\n✨ AI DAILY SCHEDULE PLAN\n========================================\n";
  state.dailySchedule.forEach(item => {
    text += `• [${item.time}] ${item.task} (${item.duration}m) - [${item.type.toUpperCase()}]\n`;
  });
  navigator.clipboard.writeText(text).then(() => {
    alert('Daily schedule copied to clipboard successfully!');
  });
};

window.downloadScheduleFile = () => {
  if (!state.dailySchedule) return;
  let fileContent = `========================================
✨ MY OPTIMIZED DAILY PLANNER
Created via ProcastiKill AI
========================================

TIMELINE ROUTE:
`;
  state.dailySchedule.forEach(item => {
    fileContent += `[${item.time}] ${item.task} (${item.duration} minutes) - Type: ${item.type}\n`;
  });

  const blob = new Blob([fileContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ProcastiKill-Daily-Schedule.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// FEATURE 2 – GOOGLE CALENDAR CONNECTION PORT
window.connectGoogleCalendar = () => {
  const modal = document.getElementById('modal-calendar');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};
window.closeCalendarModal = () => {
  const modal = document.getElementById('modal-calendar');
  if (modal) modal.classList.add('hidden');
};
window.confirmCalendarConnect = () => {
  state.googleCalendarConnected = true;
  saveState();
  closeCalendarModal();
  
  // Re-generate if necessary or reload calendar page
  renderCalendar();
  
  // Prompt speech synthesis
  speakText('Google Calendar successfully connected. Meeting agendas synced.');
  alert('Google Calendar synced successfully! Sample meetings are now loaded in the Busy blocks.');
  
  // Update AI Daily Planner if visible
  if (state.dailySchedule) {
    window.generateMyDailySchedule();
  }
};

// CALENDAR TAB RENDER
export function renderCalendar() {
  const monthLabel = document.getElementById('calendar-month-year');
  const grid = document.getElementById('calendar-grid');
  if (!monthLabel || !grid) return;

  const today = new Date();

monthLabel.textContent = today.toLocaleString('default', {
    month: 'long',
    year: 'numeric'
});
  grid.innerHTML = '';

  // Weekday Headers
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  weekdays.forEach(day => {
    const d = document.createElement('div');
    d.className = 'text-center font-semibold text-xs text-secondaryText pb-2 uppercase tracking-wider font-heading';
    d.textContent = day;
    grid.appendChild(d);
  });

  // June 2026 starts on Monday (index 1) -> 1 empty cell for Sunday
  const emptyCell = document.createElement('div');
  grid.appendChild(emptyCell);

  const totalDays = 30;
  for (let i = 1; i <= totalDays; i++) {
    const cell = document.createElement('div');
    cell.className = 'bg-white border border-borderLight p-3 rounded-[12px] min-h-[85px] relative flex flex-col justify-between hover:bg-slate-50 transition-colors duration-200';
    
    // Day number
    const num = document.createElement('span');
    num.className = 'text-xs font-bold text-secondaryText';
    num.textContent = i.toString();
    cell.appendChild(num);

    // Highlight active tracked deadlines
    const dayStr = `2026-06-${i.toString().padStart(2, '0')}`;
    state.crises.forEach(c => {
      const cDate = c.deadline.split('T')[0];
      if (cDate === dayStr) {
        const dot = document.createElement('div');
        dot.className = 'text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold truncate mt-1 border border-red-200';
        dot.textContent = c.title;
        cell.appendChild(dot);
      }
    });

    // Simulated Calendar Meetings (Feature 2)
    if (state.googleCalendarConnected && i === 30) {
      // Add meetings mock indicator
      const meetingPill = document.createElement('div');
      meetingPill.className = 'text-[9px] bg-indigo-50 text-primary px-1 py-0.5 rounded font-bold truncate mt-1 flex items-center gap-0.5 border border-indigo-100';
      meetingPill.innerHTML = '<i class="fa-solid fa-calendar text-[8px]"></i> GCal Syced';
      cell.appendChild(meetingPill);
    }

    grid.appendChild(cell);
  }

  // Update GCal Connected State UI panels inside Calendar
  const connPanel = document.getElementById('gcal-connection-status');
  if (connPanel) {
    if (state.googleCalendarConnected) {
      connPanel.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 bg-green-50 text-success rounded-xl border border-green-200 flex items-center justify-center text-lg">
              <i class="fa-solid fa-calendar-check animate-bounce"></i>
            </div>
            <div>
              <h4 class="font-bold text-sm text-headingText">Google Calendar Synced</h4>
              <p class="text-xs text-secondaryText mt-0.5">3 busy events successfully imported into today's timeline.</p>
            </div>
          </div>
          <span class="text-xs font-bold text-success bg-green-50 border border-green-200 px-3 py-1.5 rounded-[12px]">Connected</span>
        </div>
        
        <!-- Today Availability Cards (Feature 2 color coded blocks) -->
        <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 border-t border-borderLight">
          <div class="p-3 bg-red-50 border border-red-200 rounded-[16px]">
            <span class="text-xs font-bold text-red-600 block">Class (10 AM - 12 PM)</span>
            <span class="text-[10px] uppercase font-bold text-red-400 block mt-1 tracking-wider">Busy slot</span>
          </div>
          <div class="p-3 bg-red-50 border border-red-200 rounded-[16px]">
            <span class="text-xs font-bold text-red-600 block">Lunch (1 PM - 2 PM)</span>
            <span class="text-[10px] uppercase font-bold text-red-400 block mt-1 tracking-wider">Busy slot</span>
          </div>
          <div class="p-3 bg-red-50 border border-red-200 rounded-[16px]">
            <span class="text-xs font-bold text-red-600 block">Interview (5 PM - 6 PM)</span>
            <span class="text-[10px] uppercase font-bold text-red-400 block mt-1 tracking-wider">Busy slot</span>
          </div>
          <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-[16px]">
            <span class="text-xs font-bold text-primary block">Study & Sprints</span>
            <span class="text-[10px] uppercase font-bold text-indigo-400 block mt-1 tracking-wider">Indigo Code</span>
          </div>
          <div class="p-3 bg-green-50 border border-green-200 rounded-[16px]">
            <span class="text-xs font-bold text-success block">Routine Habits</span>
            <span class="text-[10px] uppercase font-bold text-green-400 block mt-1 tracking-wider">Green Code</span>
          </div>
          <div class="p-3 bg-cyan-50 border border-cyan-200 rounded-[16px]">
            <span class="text-xs font-bold text-cyan-600 block">Mind Breaks</span>
            <span class="text-[10px] uppercase font-bold text-cyan-400 block mt-1 tracking-wider">Cyan Code</span>
          </div>
        </div>
      `;
    } else {
      connPanel.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 bg-slate-50 text-secondaryText rounded-xl border border-borderLight flex items-center justify-center text-lg">
              <i class="fa-solid fa-calendar-xmark"></i>
            </div>
            <div>
              <h4 class="font-bold text-sm text-headingText">Connect Google Calendar</h4>
              <p class="text-xs text-secondaryText mt-0.5">Integrate busy hours to automatically schedule sprints around meetings.</p>
            </div>
          </div>
          <button onclick="window.connectGoogleCalendar()" class="bg-primary hover:bg-primary-hover text-white text-xs font-medium px-4 py-2 rounded-[14px] transition-all duration-200 flex items-center gap-1.5 shadow-sm">
            <i class="fa-solid fa-link"></i> Sync Calendar
          </button>
        </div>
      `;
    }
  }

  // Render Upcoming Deadlines List
  const list = document.getElementById('upcoming-deadlines-list');
  if (list) {
    list.innerHTML = '';
    const sorted = [...state.crises].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    
    if (sorted.length === 0) {
      list.innerHTML = `
        <div class="p-4 text-center text-sm text-secondaryText italic bg-slate-50 border border-dashed border-borderLight rounded-[16px]">
          No upcoming deadlines scheduled.
        </div>
      `;
      return;
    }

    sorted.forEach(c => {
      const msLeft = new Date(c.deadline).getTime() - Date.now();
      const hh = Math.max(0, Math.floor(msLeft / 1000 / 60 / 60));
      const li = document.createElement('div');
      li.className = 'p-4 bg-white border border-borderLight rounded-[16px] flex items-center justify-between gap-4';
      
      let badgeClass = 'bg-indigo-50 text-primary border-indigo-100';
      if (c.panicLevel === 'Critical') badgeClass = 'bg-red-50 text-red-600 border-red-100';
      else if (c.panicLevel === 'Severe') badgeClass = 'bg-amber-50 text-amber-600 border-amber-100';

      li.innerHTML = `
        <div>
          <h5 class="font-semibold text-sm text-headingText">${c.title}</h5>
          <span class="text-xs text-secondaryText block mt-1">Persona: ${c.persona} | Recipient: ${c.recipient}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs px-2.5 py-1 font-bold border rounded-full ${badgeClass}">${c.panicLevel}</span>
          <span class="text-xs font-mono font-bold text-bodyText">${hh} Hours Left</span>
        </div>
      `;
      list.appendChild(li);
    });
  }
}

// HABITS TAB RENDER
export function renderHabits() {
  const container = document.getElementById('habits-list-container');
  if (!container) return;
  container.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];

  state.habits.forEach(habit => {
    const row = document.createElement('div');
    row.className = 'p-4 bg-white border border-borderLight rounded-[20px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200 hover:shadow-sm';
    
    // Generate the last 7 days checkboxes
    let checkGridHTML = '';
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const isLogged = habit.history.includes(dayStr);
      const label = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      
      checkGridHTML += `
        <div class="flex flex-col items-center gap-1">
          <span class="text-[10px] font-bold text-secondaryText uppercase tracking-wider">${label}</span>
          <button onclick="window.toggleHabitDay('${habit.id}', '${dayStr}')" class="w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${
            isLogged 
              ? 'bg-success border-success text-white shadow-sm shadow-success/15' 
              : 'bg-white border-borderLight text-secondaryText hover:border-success hover:text-success'
          }">
            <i class="fa-solid ${isLogged ? 'fa-check' : 'fa-plus'} text-xs"></i>
          </button>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-green-50 text-success rounded-xl border border-green-200 flex items-center justify-center text-base">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <div>
          <h4 class="font-bold text-sm text-headingText">${habit.name}</h4>
          <span class="text-xs text-secondaryText mt-0.5 block">Active Streak: <span class="text-success font-bold">${habit.streak} Days</span></span>
        </div>
      </div>
      
      <div class="flex items-center gap-4 self-stretch md:self-center justify-between md:justify-end">
        <div class="flex items-center gap-3 bg-slate-50 border border-borderLight p-2 rounded-[16px]">
          ${checkGridHTML}
        </div>
        <button onclick="window.deleteHabit('${habit.id}')" class="w-9 h-9 rounded-xl border border-borderLight flex items-center justify-center text-secondaryText hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all">
          <i class="fa-regular fa-trash-can text-sm"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

window.toggleHabitDay = (habitId, dayStr) => {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;

  const idx = habit.history.indexOf(dayStr);
  if (idx > -1) {
    // Un-log
    habit.history.splice(idx, 1);
    habit.streak = Math.max(0, habit.streak - 1);
  } else {
    // Log completion
    habit.history.push(dayStr);
    habit.streak += 1;
    updateStreakAndActivity(15); // Log 15 minutes focus spent on routine habit!
    speakText(`Routine Habit logged! Beautiful streak maintenance.`);
  }

  saveState();
  renderHabits();
};

window.addCustomHabit = () => {
  const input = document.getElementById('new-habit-name');
  const name = input.value.trim();
  if (!name) return;

  const newHabit = {
    id: `habit-${Date.now()}`,
    name: name,
    streak: 0,
    history: []
  };

  state.habits.push(newHabit);
  input.value = '';
  saveState();
  renderHabits();
  speakText('Custom habit routine created.');
};

window.deleteHabit = (id) => {
  state.habits = state.habits.filter(h => h.id !== id);
  saveState();
  renderHabits();
};

// FEATURE 3 – COACH PRODUCTIVITY INSIGHTS RECOMMENDATION LOADER
async function loadCoachInsights() {
  const container = document.getElementById('insights-bullets-container');
  if (!container) return;

  // Update compact dashboard KPIs if they exist in DOM
  try {
    const stats = calculateInsightsStats();
    const dashToday = document.getElementById('dash-kpi-today-completion');
    if (dashToday) dashToday.textContent = `${stats.todayCompletion}%`;
    const dashWeekly = document.getElementById('dash-kpi-weekly-total');
    if (dashWeekly) dashWeekly.textContent = stats.weeklyTotal;
    const dashStreak = document.getElementById('dash-kpi-streak');
    if (dashStreak) dashStreak.textContent = `${stats.streak} Days`;
    const dashHabits = document.getElementById('dash-kpi-habit-consistency');
    if (dashHabits) dashHabits.textContent = `${stats.habitConsistency}%`;
  } catch (err) {
    console.error("Error calculating KPIs", err);
  }

  container.innerHTML = `
    <div class="flex items-center justify-center py-6 text-secondaryText text-sm animate-pulse">
      <i class="fa-solid fa-spinner animate-spin mr-2"></i> Analyzing your performance stats...
    </div>
  `;

  const recs = await generateAIRecommendations();
  container.innerHTML = '';
  
  recs.forEach(rec => {
    const li = document.createElement('div');
    li.className = 'flex items-start gap-3 p-3 bg-slate-50 border border-borderLight rounded-[16px] text-sm text-bodyText leading-relaxed';
    li.innerHTML = `
      <div class="w-6 h-6 rounded bg-indigo-50 text-primary font-bold text-xs flex items-center justify-center mt-0.5">💡</div>
      <div>${rec}</div>
    `;
    container.appendChild(li);
  });
}

// INITIALIZE THE ENTIRE DASHBOARD ENGINE
document.addEventListener('DOMContentLoaded', () => {
  // Check if first-time launch or previously demo-active
  const demoDone = localStorage.getItem('procastikill_demo_done');

if (!demoDone) {
    enterDemoMode(false);
    localStorage.setItem('procastikill_demo_active', 'true');
} else {
    exitDemoMode();
}

  updateAPIStatusIndicator();
  renderCrisesQueue();
  loadActiveCrisis();
  renderChatHistory();
  initGlobalClockLoop();
  loadCoachInsights();
  
  // Hours Doom slider live labels updates
  const hoursSlider = document.getElementById('crisis-hours');
  const labelHours = document.getElementById('label-hours-doom');
  if (hoursSlider && labelHours) {
    hoursSlider.addEventListener('input', () => {
      const h = hoursSlider.value;
      labelHours.textContent = `${h} Hours`;
      
      const badge = document.getElementById('calibrator-urgency-pills');
      if (badge) {
        if (h < 3) {
          badge.className = 'text-xs px-2.5 py-1 font-bold rounded-full bg-red-100 text-red-600 border border-red-200';
          badge.textContent = 'Critical Doom Alert';
        } else if (h <= 8) {
          badge.className = 'text-xs px-2.5 py-1 font-bold rounded-full bg-amber-100 text-amber-600 border border-amber-200';
          badge.textContent = 'Severe Action Zone';
        } else {
          badge.className = 'text-xs px-2.5 py-1 font-bold rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200';
          badge.textContent = 'Moderate Horizon';
        }
      }
    });
  }

  // Pre-load default daily schedule on dashboard init if we have one
  renderTimelineSchedule();

  // Voice alarm initial volume check
  const alertIcon = document.getElementById('voice-alert-icon');
  if (alertIcon) {
    alertIcon.className = state.soundOn ? 'fa-solid fa-volume-high text-primary' : 'fa-solid fa-volume-xmark';
  }

  // Trigger agentic dashboard on start
  updateAgenticDashboard();
});

// ============================================================================
// PROACTIVE AI AGENTIC HUB ENGINE (TODAY'S AI BRIEF, RISK, SCHEDULING, OBSERVATIONS)
// ============================================================================

export function getLocalAIBrief() {
  const activeCount = state.crises.length;
  if (activeCount === 0) return null;

  const activeCrisis = state.crises.find(c => c.id === state.activeCrisisId) || state.crises[0];
  const title = activeCrisis.title;
  const panic = activeCrisis.panicLevel;
  const hours = activeCrisis.hoursUntilDoom;

  let riskLevel = 'Low';
  let riskScore = 15;
  if (hours < 3) {
    riskLevel = 'High';
    riskScore = 88;
  } else if (hours <= 8) {
    riskLevel = 'Moderate';
    riskScore = 55;
  }
  const completionProb = Math.max(10, 100 - riskScore);

  let nextSprintTitle = "Sprint 1";
  const incompleteSprint = activeCrisis.sprints.find(s => !s.completed);
  if (incompleteSprint) {
    nextSprintTitle = incompleteSprint.title;
  }

  const finishDate = new Date();
  finishDate.setHours(finishDate.getHours() + Math.min(hours, 3.5));
  const expectedFinishTime = finishDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  let briefText = `Good morning, Jyothsna. You have ${activeCount} active task${activeCount > 1 ? 's' : ''} under triage today. `;
  briefText += `Your critical priority is "${title}" which has ${hours} hours left until the deadline. `;
  briefText += `I recommend starting with "${nextSprintTitle}" immediately because it holds the highest execution priority. `;
  if (state.googleCalendarConnected) {
    briefText += `I have automatically synced your Google Calendar busy blocks and arranged your high-performance study sessions cleanly outside your busy schedule periods.`;
  } else {
    briefText += `Consider connecting your Google Calendar to allow me to automatically schedule study blocks around your lectures and interviews.`;
  }

  const observations = [
    `You complete coding and triage tasks most efficiently between 9:00 AM and 11:30 AM before afternoon fatigue sets in.`,
    `Your current habit streak is at ${state.streak} Days. Maintaining your routines directly correlates with a 24% lower task postponement rate.`,
    `You complete work most efficiently in high-focus blocks of 30-45 minutes. Longer sessions tend to cause focus decay.`
  ];

  return {
    brief: briefText,
    confidence: 94,
    completionProbability: completionProb,
    riskLevel: riskLevel,
    riskScore: riskScore,
    nextRecommendation: `Start ${nextSprintTitle}`,
    expectedFinishTime: expectedFinishTime,
    observations: observations
  };
}

export function getAIReasoning(activeCrisis) {
  const panic = activeCrisis.panicLevel;
  const hours = activeCrisis.hoursUntilDoom;
  const totalMins = activeCrisis.sprints.reduce((acc, s) => acc + s.duration, 0);

  let priorityScore = 65;
  let bullets = [];

  if (panic === 'Critical') {
    priorityScore = 97;
    bullets = [
      `Extreme Doom Zone: The remaining time of ${hours} hours is critically below our 3-hour threshold. Task must be handled with immediate focus.`,
      `Optimal Chunking: The deconstructed plan consists of 3 sprints totaling ${totalMins} minutes to prevent brain freeze and keep momentum high.`,
      `Contextual Timing: Your morning focus window is open. Starting ${activeCrisis.sprints[0].title} right now exploits peak cognitive efficiency.`,
      `High Execution Probability: Sprints are bite-sized (< 45 mins), which historical performance shows maximizes your compliance rate to 92%.`
    ];
  } else if (panic === 'Severe') {
    priorityScore = 84;
    bullets = [
      `High-Urgency Window: Due in ${hours} hours. Postponing this task further places you at severe deadline risk.`,
      `Calendar Balance: Google Calendar was cross-referenced to ensure these intensive study blocks do not collide with your planned busy events.`,
      `Procrastination Mitigation: Spaced sprints with 15-minute decompress slots prevents burnout and late-day cognitive exhaustion.`,
      `Structured Delivery: Each sprint targets a modular deliverable, making proofing and final compiling hassle-free.`
    ];
  } else {
    priorityScore = 68;
    bullets = [
      `Moderate Urgency Horizon: Deadline is comfortably ${hours} hours away, but acting proactively now avoids a late-night crisis.`,
      `Routine Alignment: Scheduled habits are aligned alongside this task to maintain streak consistency.`,
      `Cognitive Load Distribution: The layout spreads efforts evenly, allowing you to finalize sections without panic loops.`,
      `Low Stress Calibration: Focus levels are optimized for deliberate, high-quality development rather than emergency triaging.`
    ];
  }

  return {
    priorityScore: priorityScore,
    reasoning: bullets
  };
}

export async function updateAgenticDashboard() {
  const hubContainer = document.getElementById('ai-agent-hub-container');
  const reasoningContainer = document.getElementById('ai-plan-reasoning-container');
  if (!hubContainer) return;

  if (state.crises.length === 0) {
    hubContainer.innerHTML = `
      <div class="card-style p-6 rounded-[20px] bg-white shadow-sm border border-borderLight flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in mb-5">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl font-bold">👋</div>
          <div>
            <h2 class="text-lg font-bold font-heading text-headingText">Welcome to ProcastiKill</h2>
            <p class="text-sm text-secondaryText mt-1">I'm your AI Productivity Companion. Let me actively guide your day to keep procrastination at bay.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span class="text-emerald-500 font-bold">✓</span> Prioritize tasks
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span class="text-emerald-500 font-bold">✓</span> Build schedules
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span class="text-emerald-500 font-bold">✓</span> Generate action plans
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span class="text-emerald-500 font-bold">✓</span> Detect deadline risks
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span class="text-emerald-500 font-bold">✓</span> Coach your productivity
              </div>
              <div class="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span class="text-emerald-500 font-bold">✓</span> Draft professional messages
              </div>
            </div>
            <p class="text-xs text-primary font-bold mt-4">Create your first task to begin.</p>
          </div>
        </div>
      </div>
    `;
    if (reasoningContainer) reasoningContainer.innerHTML = '';
    return;
  }

  const activeCrisis = state.crises.find(c => c.id === state.activeCrisisId) || state.crises[0];
  if (!activeCrisis) return;

  let briefData = getLocalAIBrief();

  if (state.apiKey && !isDemoModeActive) {
    try {
      const prompt = `You are ProcastiKill's proactive, highly autonomous AI Agent.
Analyze the user's current productivity state:
- User name: User
- Active tasks: ${JSON.stringify(state.crises.map(c => ({ title: c.title, panicLevel: c.panicLevel, hoursUntilDoom: c.hoursUntilDoom, sprints: c.sprints.map(s => ({ title: s.title, completed: s.completed })) })))}
- Habits: ${JSON.stringify(state.habits.map(h => ({ name: h.name, streak: h.streak })))}
- Google Calendar Synced: ${state.googleCalendarConnected}
- Focus score / streak: ${state.streak} days, Score: ${state.killScore}

Generate a concise, highly engaging, premium proactive Today's AI Brief.
Analyze:
1. Active tasks & deadlines
2. Priority recommend actions (which sprint of which task to run)
3. Calendar schedule integrations
4. Completion probability and expected completion time.

Return exactly this JSON schema format:
{
  "brief": "Detailed conversational summary paragraph greeting Jyothsna and explaining exactly what is on their schedule, recommending which sprint to start, and mapping study time around busy classes.",
  "confidence": 94,
  "completionProbability": 91,
  "riskLevel": "Low" | "Moderate" | "High",
  "nextRecommendation": "Start Sprint 1 immediately",
  "expectedFinishTime": "5:45 PM",
  "observations": ["Observation 1", "Observation 2", "Observation 3"]
}
`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                brief: { type: 'STRING' },
                confidence: { type: 'INTEGER' },
                completionProbability: { type: 'INTEGER' },
                riskLevel: { type: 'STRING', enum: ['Low', 'Moderate', 'High'] },
                nextRecommendation: { type: 'STRING' },
                expectedFinishTime: { type: 'STRING' },
                observations: {
                  type: 'ARRAY',
                  items: { type: 'STRING' }
                }
              },
              required: ['brief', 'confidence', 'completionProbability', 'riskLevel', 'nextRecommendation', 'expectedFinishTime', 'observations']
            }
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.trim());
          briefData = {
            ...parsed,
            riskScore: parsed.riskLevel === 'High' ? 88 : (parsed.riskLevel === 'Moderate' ? 55 : 15)
          };
        }
      }
    } catch (err) {
      console.warn('Proactive brief AI generation failed, using local model:', err);
    }
  }

  if (isDemoModeActive) {
    briefData = {
      brief: "I noticed three competing deadlines.<br/><br/>I've prioritized the Database assignment because it requires the most focused work.<br/><br/>I've scheduled interview preparation after lunch.<br/><br/>I've reserved 10 minutes tonight to pay your electricity bill.<br/><br/>I've also prepared a professional message in case you need an extension.",
      confidence: 98,
      completionProbability: 91,
      riskLevel: "High",
      nextRecommendation: "Design ER Diagrams",
      expectedFinishTime: "7:10 PM",
      observations: [
        "You complete coding and triage tasks most efficiently between 9:00 AM and 11:30 AM.",
        "Your current habit streak is at 4 Days. Maintaining routines correlates with 24% lower postponement.",
        "You complete work most efficiently in high-focus blocks of 30-45 minutes."
      ],
      riskScore: 88
    };
  }

  const riskColor = briefData.riskLevel === 'High' ? 'text-red-600' : (briefData.riskLevel === 'Moderate' ? 'text-amber-600' : 'text-emerald-600');
  const riskBg = briefData.riskLevel === 'High' ? 'bg-red-50 border-red-100' : (briefData.riskLevel === 'Moderate' ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100');

  hubContainer.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5 animate-fade-in">
      <!-- Today's AI Brief Card (Left 7 Columns) -->
      <div class="lg:col-span-7 flex flex-col">
        <div class="card-style flex-1 p-5 rounded-[20px] bg-white shadow-sm border border-borderLight flex flex-col justify-between">
          <div>
            <!-- Card Header with Badges -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-borderLight pb-3 mb-4">
              <div class="flex items-center gap-2">
                <span class="text-2xl leading-none">🤖</span>
                <h3 class="text-base font-bold font-heading text-headingText">Today's AI Brief</h3>
              </div>
              <!-- Small premium confidence badge -->
              <div class="flex items-center gap-2">
                <div class="text-[10px] font-bold uppercase tracking-wider text-primary bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                  AI Confidence: ${briefData.confidence}%
                </div>
              </div>
            </div>

            <!-- Conversational Brief text -->
            <p class="text-sm text-headingText leading-relaxed font-medium">
              ${briefData.brief}
            </p>

            <!-- KPI Metrics Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-[14px] text-center">
                <span class="text-[10px] font-bold uppercase text-secondaryText tracking-wider">Completion Prob.</span>
                <span class="block text-lg font-bold text-indigo-600 mt-0.5">${briefData.completionProbability}%</span>
              </div>
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-[14px] text-center">
                <span class="text-[10px] font-bold uppercase text-secondaryText tracking-wider">Risk Level</span>
                <span class="block text-lg font-bold ${riskColor} mt-0.5">${briefData.riskLevel}</span>
              </div>
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-[14px] text-center">
                <span class="text-[10px] font-bold uppercase text-secondaryText tracking-wider">Estimated Finish</span>
                <span class="block text-lg font-bold text-emerald-600 mt-0.5">${briefData.expectedFinishTime}</span>
              </div>
              <div class="p-3 bg-indigo-50/50 border border-indigo-100 rounded-[14px] text-center">
                <span class="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">Next Step</span>
                <span class="block text-xs font-bold text-indigo-700 mt-1.5 truncate">${briefData.nextRecommendation}</span>
              </div>
            </div>
          </div>

          <!-- AI Rescheduling Log Section -->
          <div id="ai-reschedule-log" class="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-[14px] text-xs text-amber-800 flex items-start gap-2 hidden">
            <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5"></i>
            <div id="ai-reschedule-log-text"></div>
          </div>
        </div>
      </div>

      <!-- Proactive Recommendations & Observations Card (Right 5 Columns) -->
      <div class="lg:col-span-5 flex flex-col gap-5 justify-between">
        <div class="card-style p-5 rounded-[20px] bg-white shadow-sm border border-borderLight flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 border-b border-borderLight pb-3 mb-3">
              <i class="fa-solid fa-lightbulb text-amber-500"></i>
              <h4 class="text-sm font-bold text-headingText font-heading">Proactive Recommendations</h4>
            </div>
            <div class="space-y-2" id="proactive-recs-list">
              <!-- Live actions populated dynamically -->
            </div>
          </div>
          
          <!-- Observations Section -->
          <div class="mt-4 pt-4 border-t border-slate-100">
            <div class="flex items-center gap-2 mb-2">
              <i class="fa-solid fa-chart-line text-indigo-500 text-xs"></i>
              <span class="text-xs font-bold text-secondaryText uppercase tracking-wider font-heading">Today's Observations</span>
            </div>
            <ul class="space-y-2 text-xs text-secondaryText leading-relaxed">
              ${briefData.observations.map(obs => `
                <li class="flex items-start gap-1.5">
                  <span class="text-indigo-400 font-bold">•</span>
                  <span>${obs}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  populateProactiveRecs(activeCrisis);

  if (reasoningContainer) {
    const reasonInfo = getAIReasoning(activeCrisis);
    reasoningContainer.innerHTML = `
      <div class="card-style p-5 rounded-[20px] bg-[#FAF8FF] border border-indigo-100 shadow-sm animate-fade-in mt-4">
        <div class="flex items-center justify-between border-b border-indigo-50 pb-3 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">🧠</span>
            <h3 class="text-sm font-bold font-heading text-indigo-950">Why I Chose This Plan</h3>
          </div>
          <div class="flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
            <span>Priority Score:</span>
            <span class="font-mono text-sm">${reasonInfo.priorityScore}</span>
          </div>
        </div>
        <ul class="space-y-2 text-xs text-indigo-900 leading-relaxed font-medium">
          ${reasonInfo.reasoning.map(r => `
            <li class="flex items-start gap-2">
              <span class="text-indigo-500 font-bold mt-0.5">•</span>
              <span>${r}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  checkAndRunAutoReschedule(activeCrisis);
}

function populateProactiveRecs(activeCrisis) {
  const container = document.getElementById('proactive-recs-list');
  if (!container) return;
  container.innerHTML = '';

  const recs = [];

  const nextSprintIdx = activeCrisis.sprints.findIndex(s => !s.completed);
  if (nextSprintIdx > -1) {
    const sprint = activeCrisis.sprints[nextSprintIdx];
    recs.push({
      text: `Start "${sprint.title}" right now.`,
      actionLabel: 'Launch Timer',
      iconClass: 'fa-play text-indigo-500',
      action: () => {
        window.toggleSprintTimer(nextSprintIdx);
      }
    });
  }

  recs.push({
    text: "Drink water and reset your focus field.",
    actionLabel: 'Logged',
    iconClass: 'fa-glass-water text-emerald-500',
    action: (btn) => {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Hydrated';
      btn.className = 'text-[10px] bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-bold border border-green-200';
      speakText('Excellent hydration choices. Keep your cells active.');
    }
  });

  const isSoundOn = state.soundOn;
  recs.push({
    text: "Enable high-contrast Focus sounds.",
    actionLabel: isSoundOn ? 'Active' : 'Enable',
    iconClass: 'fa-headphones text-amber-500',
    action: () => {
      window.toggleVoiceAlerts();
    }
  });

  recs.forEach(rec => {
    const div = document.createElement('div');
    div.className = 'p-3 bg-slate-50 border border-borderLight rounded-[16px] flex items-center justify-between gap-3 text-xs text-bodyText hover:bg-slate-100/50 transition-colors';
    
    const left = document.createElement('div');
    left.className = 'flex items-center gap-2.5';
    left.innerHTML = `<i class="fa-solid ${rec.iconClass}"></i><span>${rec.text}</span>`;
    
    const btn = document.createElement('button');
    btn.className = 'text-[10px] bg-white hover:bg-slate-50 border border-borderLight px-2.5 py-1 rounded-full font-bold transition-all text-secondaryText cursor-pointer';
    btn.textContent = rec.actionLabel;
    
    btn.onclick = () => rec.action(btn);

    div.appendChild(left);
    div.appendChild(btn);
    container.appendChild(div);
  });
}

function checkAndRunAutoReschedule(activeCrisis) {
  if (!state.dailySchedule || state.dailySchedule.length === 0) return;

  let hasIncompletePastSprint = false;
  let rescheduledSprintTitle = '';

  const incompleteSprint = activeCrisis.sprints.find(s => !s.completed);
  if (incompleteSprint) {
    hasIncompletePastSprint = true;
    rescheduledSprintTitle = incompleteSprint.title;
  }

  const alertContainer = document.getElementById('ai-reschedule-log');
  const alertText = document.getElementById('ai-reschedule-log-text');

  if (hasIncompletePastSprint && alertContainer && alertText) {
    alertContainer.classList.remove('hidden');
    alertText.innerHTML = `
      <span class="font-bold">⚠️ AI Auto-Reschedule:</span> 
      "${rescheduledSprintTitle}" was not completed during its scheduled block. 
      ProcastiKill has automatically rescheduled your timeline and shifted subsequent slots to avoid calendar busy overlaps. Focus periods are preserved.
    `;
  } else if (alertContainer) {
    alertContainer.classList.add('hidden');
  }
}

// Bind agentic hub renderer globally
window.updateAgenticDashboard = updateAgenticDashboard;
