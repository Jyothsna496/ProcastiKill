// ProcastiKill - Shared App State Manager

export let state = {
  apiKey: localStorage.getItem('proastikill_api_key') || '',
  crises: JSON.parse(localStorage.getItem('proastikill_crises')) || [],
  activeCrisisId: localStorage.getItem('proastikill_active_crisis_id') || '',
  habits: JSON.parse(localStorage.getItem('proastikill_habits')) || [
    { id: 'h1', name: 'Morning Triage Planning', streak: 2, history: ['2026-06-29', '2026-06-28'] },
    { id: 'h2', name: 'Inbox Zero & Clean Workspace', streak: 4, history: ['2026-06-29', '2026-06-28', '2026-06-27', '2026-06-26'] },
    { id: 'h3', name: '30-Minute Workout/Refresher', streak: 0, history: [] }
  ],
  streak: parseInt(localStorage.getItem('proastikill_streak')) || 4,
  lastActiveDate: localStorage.getItem('proastikill_last_active_date') || '2026-06-29',
  killScore: parseInt(localStorage.getItem('proastikill_kill_score')) || 1400,
  chatHistory: JSON.parse(localStorage.getItem('proastikill_chat_history')) || [
    { sender: 'ai', text: 'Procrastination is an active threat to your survival. Declare your looming deadline above, and we will deconstruct it into 3 surgical execution sprints immediately.' }
  ],
  soundOn: localStorage.getItem('proastikill_sound_on') === 'true',
  googleCalendarConnected: localStorage.getItem('proastikill_calendar_connected') === 'true',
  activeTab: 'dashboard',
  dailySchedule: JSON.parse(localStorage.getItem('proastikill_daily_schedule')) || null,
  loggedStats: JSON.parse(localStorage.getItem('proastikill_logged_stats')) || {
    focusMinutes: 180,
    tasksCompleted: 14,
    weeklyHistory: [3, 5, 2, 4, 3, 5, 4], // sprints completed Mon-Sun
    habitCompletionHistory: [66, 100, 33, 66, 66, 100, 66], // habits completed % Mon-Sun
    focusTimeHistory: [60, 45, 30, 90, 120, 75, 60] // focus minutes spent Mon-Sun
  }
};

export function saveState() {
  localStorage.setItem('proastikill_api_key', state.apiKey);
  localStorage.setItem('proastikill_crises', JSON.stringify(state.crises));
  localStorage.setItem('proastikill_active_crisis_id', state.activeCrisisId);
  localStorage.setItem('proastikill_habits', JSON.stringify(state.habits));
  localStorage.setItem('proastikill_streak', state.streak.toString());
  localStorage.setItem('proastikill_last_active_date', state.lastActiveDate);
  localStorage.setItem('proastikill_kill_score', state.killScore.toString());
  localStorage.setItem('proastikill_chat_history', JSON.stringify(state.chatHistory));
  localStorage.setItem('proastikill_sound_on', state.soundOn.toString());
  localStorage.setItem('proastikill_calendar_connected', state.googleCalendarConnected.toString());
  localStorage.setItem('proastikill_daily_schedule', JSON.stringify(state.dailySchedule));
  localStorage.setItem('proastikill_logged_stats', JSON.stringify(state.loggedStats));
}

export function updateStreakAndActivity(minutesSpent) {
  const todayStr = new Date().toISOString().split('T')[0];
  state.loggedStats.focusMinutes += minutesSpent;
  state.loggedStats.tasksCompleted += 1;
  state.killScore += 100;
  
  // Check daily streak
  if (state.lastActiveDate !== todayStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (state.lastActiveDate === yesterdayStr) {
      state.streak += 1;
    } else if (state.lastActiveDate !== todayStr) {
      state.streak = 1;
    }
    state.lastActiveDate = todayStr;
  }
  
  // Update focus time history for today (Sunday in this array representation)
  state.loggedStats.focusTimeHistory[state.loggedStats.focusTimeHistory.length - 1] += minutesSpent;
  state.loggedStats.weeklyHistory[state.loggedStats.weeklyHistory.length - 1] += 1;
  
  saveState();
}
