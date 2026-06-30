// ProcastiKill - Productivity Insights & Chart Engine
import { state } from './state.js';

let chartInstances = {};

export function calculateInsightsStats() {
  const stats = {
    todayCompletion: 0,
    weeklyTotal: 0,
    focusMinutes: state.loggedStats.focusMinutes,
    streak: state.streak,
    avgTaskDuration: 0,
    mostProductiveDay: 'Tuesday',
    habitConsistency: 0
  };

  // Sprints stats
  let totalSprints = 0;
  let completedSprints = 0;
  let durationSum = 0;
  
  state.crises.forEach(crisis => {
    crisis.sprints.forEach(sprint => {
      totalSprints++;
      durationSum += sprint.duration;
      if (sprint.completed) {
        completedSprints++;
      }
    });
  });

  stats.todayCompletion = totalSprints > 0 ? Math.round((completedSprints / totalSprints) * 100) : 75;
  stats.avgTaskDuration = totalSprints > 0 ? Math.round(durationSum / totalSprints) : 45;
  stats.weeklyTotal = state.loggedStats.tasksCompleted;

  // Habit stats
  let totalHabitLogs = 0;
  state.habits.forEach(habit => {
    totalHabitLogs += habit.history.length;
  });
  const maxPossibleLogs = state.habits.length * 7;
  stats.habitConsistency = maxPossibleLogs > 0 ? Math.round((totalHabitLogs / maxPossibleLogs) * 100) : 83;

  return stats;
}

// AI RECOMMENDATIONS / MOTIVATIONS (FEATURE 3)
export async function generateAIRecommendations() {
  const stats = calculateInsightsStats();
  
  if (!state.apiKey) {
    return getLocalRecommendations(stats);
  }
  
  const prompt = `You are ProcastiKill's elite, high-performance coaching engine.
Given the following productivity statistics of a user who is trying to beat procrastination:
- Total focus time: ${stats.focusMinutes} minutes
- Weekly tasks/sprints completed: ${stats.weeklyTotal}
- Daily focus streak: ${stats.streak} days
- Average task/sprint duration: ${stats.avgTaskDuration} minutes
- Habit consistency rate: ${stats.habitConsistency}%

Provide exactly 3 custom, blunt, highly tactical, slightly sarcastic coaching recommendations to optimize the user's workflow.
Return a JSON array of strings:
{
  "recommendations": [
    "String 1",
    "String 2",
    "String 3"
  ]
}`;

  const schema = {
    type: 'OBJECT',
    properties: {
      recommendations: {
        type: 'ARRAY',
        items: { type: 'STRING' }
      }
    },
    required: ['recommendations']
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const res = JSON.parse(text.trim());
        return res.recommendations;
      }
    }
    return getLocalRecommendations(stats);
  } catch (err) {
    console.warn('AI recommendation fetch failed, using local rule fallback:', err);
    return getLocalRecommendations(stats);
  }
}

function getLocalRecommendations(stats) {
  return [
    `You complete difficult work most efficiently in high-focus sprints of ${stats.avgTaskDuration} minutes. Anything longer and you run off to scroll social media. Keep using the timer.`,
    `Your habit consistency is currently at ${stats.habitConsistency}%. Do not let your streak of ${stats.streak} days slip today, or we will increase the tough-love voice alert volume!`,
    "Pro-tip: You usually miss evening tasks due to late-day cognitive fatigue. Triage and schedule your most critical sprints strictly between 9:00 AM and 11:30 AM."
  ];
}

// INITIALIZE AND RENDER CHART.JS (FEATURE 3 VISUALS)
export function renderInsightsCharts() {
  try {
    // Destroy previous instances to avoid canvas reuse errors
    if (chartInstances.weekly) chartInstances.weekly.destroy();
    if (chartInstances.habits) chartInstances.habits.destroy();
    if (chartInstances.focus) chartInstances.focus.destroy();

    const stats = calculateInsightsStats();

    // Chart 1: Weekly Sprints Completed (Bar Chart)
    const ctxWeekly = document.getElementById('chart-weekly');
    if (ctxWeekly) {
      chartInstances.weekly = new Chart(ctxWeekly.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Completed Sprints',
            data: state.loggedStats.weeklyHistory,
            backgroundColor: '#4F46E5', // Primary Brand Indigo
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 24
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: { 
              beginAtZero: true, 
              grid: { color: '#F1F5F9' },
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }

    // Chart 2: Habit Completion History (Line Chart)
    const ctxHabits = document.getElementById('chart-habits');
    if (ctxHabits) {
      chartInstances.habits = new Chart(ctxHabits.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Completion %',
            data: state.loggedStats.habitCompletionHistory,
            borderColor: '#16A34A', // Success Green
            backgroundColor: 'rgba(22, 163, 74, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: '#16A34A',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false } },
            y: { min: 0, max: 100, grid: { color: '#F1F5F9' } }
          }
        }
      });
    }

    // Chart 3: Focus Time Distribution (Doughnut Chart)
    const ctxFocus = document.getElementById('chart-focus');
    if (ctxFocus) {
      chartInstances.focus = new Chart(ctxFocus.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Study Sprints', 'Routine Habits', 'Mind Breaks'],
          datasets: [{
            data: [
              stats.focusMinutes,
              state.habits.length * 15, // Estimate 15 mins logged per habit
              35 // Break minutes
            ],
            backgroundColor: [
              '#4F46E5', // Primary Indigo
              '#16A34A', // Success Green
              '#06B6D4'  // Accent Cyan
            ],
            borderWidth: 3,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { family: 'Inter', size: 12 }
              }
            }
          },
          cutout: '70%'
        }
      });
    }
  } catch (e) {
    console.error('Chart.js render failure:', e);
  }
}
