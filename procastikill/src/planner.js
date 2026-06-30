// ProcastiKill - Triage Planner & Daily Scheduler
import { state } from './state.js';

// Call raw Gemini 2.0 Flash API direct POST
async function fetchGeminiAPI(promptText, responseSchema) {
  if (!state.apiKey) {
    throw new Error('API Key missing');
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`;
  
  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema
    }
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`Gemini API Error: Status ${response.status}`);
  }
  
  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error('Malformed Gemini response payload');
  }
  
  return JSON.parse(textResponse.trim());
}

// TRIAGE NEW CRISIS
export async function triageCrisisPlan(title, desc, hours, persona, recipient) {
  const prompt = `You are ProcastiKill's elite, urgency-first productivity triage companion.
The user is experiencing high-urgency procrastination panic.
CRISIS TITLE: "${title}"
CRISIS DETAILS: "${desc}"
HOURS REMAINING UNTIL DEADLINE: ${hours} hours
USER PERSONA: ${persona} (adopt tone/vocabulary that motivates this person)
RECIPIENT OF FINAL PRODUCT: ${recipient} (the draft must target this person)

Perform triage:
1. Determine Urgency Panic Level ("Critical" for <3h, "Severe" for 4-8h, "Moderate" for 9-24h).
2. Deconstruct this crisis into exactly 3 progressive execution sprints (each with a concise, actionable title, duration in minutes, and direct task instructions).
3. Draft a realistic, tactful buy-more-time communication message requesting an extension from the recipient, using the user's persona traits and explaining that final work is in execution stages.
4. Give a blunt, sarcastic, but highly motivating tough-love quote to kickstart active execution.

You must return exactly this JSON schema structure:
{
  "panicLevel": "Critical" | "Severe" | "Moderate",
  "sprints": [
    { "title": "Sprint 1 Name", "duration": minutes, "task": "Task instructions" },
    { "title": "Sprint 2 Name", "duration": minutes, "task": "Task instructions" },
    { "title": "Sprint 3 Name", "duration": minutes, "task": "Task instructions" }
  ],
  "draft": "Subject & email body text here",
  "motivation": "Sarcastic tough love encouragement quote"
}`;

  const schema = {
    type: 'OBJECT',
    properties: {
      panicLevel: { type: 'STRING', enum: ['Critical', 'Severe', 'Moderate'] },
      sprints: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            duration: { type: 'INTEGER' },
            task: { type: 'STRING' }
          },
          required: ['title', 'duration', 'task']
        }
      },
      draft: { type: 'STRING' },
      motivation: { type: 'STRING' }
    },
    required: ['panicLevel', 'sprints', 'draft', 'motivation']
  };

  try {
    const result = await fetchGeminiAPI(prompt, schema);
    document.getElementById('api-status-dot').className = 'w-2.5 h-2.5 rounded-full bg-success';
    document.getElementById('api-status-label').textContent = 'Gemini Flash Core';
    return result;
  } catch (error) {
    console.warn('Gemini triage failed, falling back to local heuristic core:', error);
    document.getElementById('api-status-dot').className = 'w-2.5 h-2.5 rounded-full bg-warning';
    document.getElementById('api-status-label').textContent = 'Local Heuristic';
    return generateLocalCrisisPlan(title, desc, hours, persona, recipient);
  }
}

// DETECTOR / HEURISTIC FALLBACK FOR CRISIS TRIAGE
function generateLocalCrisisPlan(title, desc, hours, persona, recipient) {
  let panicLevel = 'Moderate';
  if (hours < 3) panicLevel = 'Critical';
  else if (hours <= 8) panicLevel = 'Severe';
  
  // Calculate sprint lengths based on hours left (constrained to logical study chunks)
  const totalMins = hours * 60;
  let sprint1 = Math.min(Math.round(totalMins * 0.15), 45);
  let sprint2 = Math.min(Math.round(totalMins * 0.25), 90);
  let sprint3 = Math.min(Math.round(totalMins * 0.15), 45);
  
  if (sprint1 < 15) sprint1 = 20;
  if (sprint2 < 20) sprint2 = 45;
  if (sprint3 < 15) sprint3 = 20;
  
  const sprints = [
    {
      title: 'Triage Phase: Skeletal Outline',
      duration: sprint1,
      task: `Establish the structural foundation for "${title}". Spend ${sprint1} minutes mapping out headings, draft templates, or code boilerplate. Do not write filler.`
    },
    {
      title: 'Execution Phase: High-Focus Core',
      duration: sprint2,
      task: `Block all distraction channels. Spend ${sprint2} minutes building out the primary technical modules, critical arguments, or visual decks needed.`
    },
    {
      title: 'Polish Phase: Proof & Polish',
      duration: sprint3,
      task: `Do a full review pass of the deliverables. Tidy styling, run compiles, double-check citations, and verify against requirements.`
    }
  ];
  
  const motivationText = `Listen, ${persona}. You have only ${hours} hours left. Your ${recipient} is waiting, and wishing won't compile this. Start Sprint 1 now or prepare for the consequences.`;
  
  const draftText = `Subject: Quick Update: ${title} Progress

Hi ${recipient},

I wanted to give you a brief status update on "${title}". I am actively executing the final phases of delivery, deconstructing the remaining tasks into intensive review milestones to ensure everything meets the high standards of quality we expect.

I am on track to finalize the delivery. If I encounter any unexpected final compiling delays, I will alert you immediately.

Best regards,
Your Dedicated ${persona}`;

  return { panicLevel, sprints, draft: draftText, motivation: motivationText };
}

// GENERATE OPTIMIZED DAILY SCHEDULE (FEATURE 1 & FEATURE 2 BUSY SLOT CHECK)
export async function generateDailyPlanner() {
  const activeCrisis = state.crises.find(c => c.id === state.activeCrisisId);
  const tasksToSchedule = [];
  
  if (activeCrisis) {
    activeCrisis.sprints.forEach((sprint, idx) => {
      if (!sprint.completed) {
        tasksToSchedule.push({
          name: `${activeCrisis.title} - ${sprint.title}`,
          duration: sprint.duration,
          type: 'study'
        });
      }
    });
  } else {
    // If no active crisis, populate with clean baseline tasks
    tasksToSchedule.push(
      { name: 'Core Task: Research & Layout Planning', duration: 60, type: 'study' },
      { name: 'Core Task: Architecture Implementation', duration: 90, type: 'study' },
      { name: 'Core Task: Final Polishing & Compilation', duration: 45, type: 'study' }
    );
  }
  
  const habitsToSchedule = state.habits.map(h => ({ name: h.name, duration: 25, type: 'habit' }));
  
  const prompt = `You are ProcastiKill's elite, high-performance daily schedule optimization engine.
Synthesize an optimized schedule starting from 8:00 AM.
Tasks to slot: ${JSON.stringify(tasksToSchedule)}
Habits to schedule: ${JSON.stringify(habitsToSchedule)}
Google Calendar Connected: ${state.googleCalendarConnected}
${state.googleCalendarConnected ? 'IMPORTANT: Google Calendar Synced Busy hours: "Class 10:00-12:00", "Lunch 13:00-14:00", "Interview 17:00-18:00". You MUST schedule study & habit sessions strictly AROUND these busy slots! Do NOT schedule study tasks during busy times!' : ''}

Schedule layout rules:
- Slot breaks (15-min) after any intense study session.
- Keep the timeline clean.
- Return a JSON object with this exact schema:
{
  "schedule": [
    { "time": "8:00–8:30", "task": "Activity name", "type": "busy" | "study" | "habit" | "break", "duration": minutes }
  ]
}`;

  const schema = {
    type: 'OBJECT',
    properties: {
      schedule: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            time: { type: 'STRING' },
            task: { type: 'STRING' },
            type: { type: 'STRING', enum: ['busy', 'study', 'habit', 'break'] },
            duration: { type: 'INTEGER' }
          },
          required: ['time', 'task', 'type', 'duration']
        }
      }
    },
    required: ['schedule']
  };

  try {
    const result = await fetchGeminiAPI(prompt, schema);
    document.getElementById('api-status-dot').className = 'w-2.5 h-2.5 rounded-full bg-success';
    document.getElementById('api-status-label').textContent = 'Gemini Flash Core';
    state.dailySchedule = result.schedule;
    return result.schedule;
  } catch (err) {
    console.warn('Daily planner generation failed, generating schedule locally:', err);
    document.getElementById('api-status-dot').className = 'w-2.5 h-2.5 rounded-full bg-warning';
    document.getElementById('api-status-label').textContent = 'Local Heuristic';
    const localSched = generateLocalSchedule(tasksToSchedule, habitsToSchedule);
    state.dailySchedule = localSched;
    return localSched;
  }
}

// LOCAL HEURISTIC PLANNER GENERATOR (Feature 2 Smart schedule-around-busy integration)
function generateLocalSchedule(tasks, habits) {
  const schedule = [];
  let currentMinutes = 480; // 8:00 AM in minutes from midnight
  
  // Convert time to format (e.g. 480 -> "8:00", 630 -> "10:30")
  function minToTimeStr(mins) {
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const displayHour = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
    return `${displayHour}:${mm.toString().padStart(2, '0')} ${ampm}`;
  }
  
  const busySlots = [];
  if (state.googleCalendarConnected) {
    busySlots.push(
      { name: 'Class', start: 600, end: 720 }, // 10:00 - 12:00
      { name: 'Lunch', start: 780, end: 840 }, // 13:00 - 14:00
      { name: 'Interview', start: 1020, end: 1080 } // 17:00 - 18:00
    );
  }
  
  // Place a task item into the timeline, checking for busy periods and inserting busy slots automatically
  function addSlot(duration, name, type) {
    let startMin = currentMinutes;
    let endMin = currentMinutes + duration;
    
    // Check if this time range overlaps with any busy slot
    for (const slot of busySlots) {
      if (startMin < slot.end && endMin > slot.start) {
        // We have an overlap! Insert the busy slot first, jump past it, then place the task
        schedule.push({
          time: `${minToTimeStr(slot.start)}–${minToTimeStr(slot.end)}`,
          task: `[Calendar Sync] ${slot.name}`,
          type: 'busy',
          duration: slot.end - slot.start
        });
        currentMinutes = slot.end;
        startMin = currentMinutes;
        endMin = currentMinutes + duration;
      }
    }
    
    schedule.push({
      time: `${minToTimeStr(startMin)}–${minToTimeStr(endMin)}`,
      task: name,
      type: type,
      duration: duration
    });
    
    currentMinutes = endMin;
  }
  
  // 1. Morning Triage Planning habit
  addSlot(20, 'Morning Planning Triage', 'habit');
  
  // 2. Schedule Task 1
  if (tasks[0]) {
    addSlot(tasks[0].duration, tasks[0].name, 'study');
    addSlot(15, 'Surgical Mind Reset Break', 'break');
  }
  
  // 3. Google Calendar Buffer classes (if connected and we haven't hit them, run check)
  if (state.googleCalendarConnected && currentMinutes < 600) {
    // Fill up to Class start with break
    const fillDur = 600 - currentMinutes;
    if (fillDur > 0) {
      addSlot(fillDur, 'Focus Buffer Break', 'break');
    }
  }
  
  // Google Calendar slot force check
  if (state.googleCalendarConnected && currentMinutes >= 600 && currentMinutes < 720) {
    schedule.push({
      time: '10:00 AM–12:00 PM',
      task: '[Calendar Sync] Class',
      type: 'busy',
      duration: 120
    });
    currentMinutes = 720; // jump past Class
  }
  
  // 4. Task 2
  if (tasks[1]) {
    addSlot(tasks[1].duration, tasks[1].name, 'study');
    addSlot(15, 'Decompressing Mind Rest', 'break');
  }
  
  // Google Calendar lunch force check
  if (state.googleCalendarConnected && currentMinutes >= 780 && currentMinutes < 840) {
    schedule.push({
      time: '1:00 PM–2:00 PM',
      task: '[Calendar Sync] Lunch',
      type: 'busy',
      duration: 60
    });
    currentMinutes = 840; // jump past Lunch
  }
  
  // 5. Habits
  habits.forEach(h => {
    addSlot(25, `${h.name} Routine`, 'habit');
  });
  
  // 6. Task 3
  if (tasks[2]) {
    addSlot(tasks[2].duration, tasks[2].name, 'study');
    addSlot(15, 'Wrap-up Reflection Break', 'break');
  }
  
  // Google Calendar interview force check
  if (state.googleCalendarConnected && currentMinutes >= 1020 && currentMinutes < 1080) {
    schedule.push({
      time: '5:00 PM–6:00 PM',
      task: '[Calendar Sync] Interview',
      type: 'busy',
      duration: 60
    });
    currentMinutes = 1080;
  }
  
  // Fill in busy slots if they weren't added in the stream
  if (state.googleCalendarConnected) {
    busySlots.forEach(s => {
      const alreadyAdded = schedule.some(item => item.task.includes(s.name));
      if (!alreadyAdded) {
        schedule.push({
          time: `${minToTimeStr(s.start)}–${minToTimeStr(s.end)}`,
          task: `[Calendar Sync] ${s.name}`,
          type: 'busy',
          duration: s.end - s.start
        });
      }
    });
  }
  
  // Sort schedule items by their start time
  schedule.sort((a, b) => {
    const timeToMin = (str) => {
      const match = str.split('–')[0].trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 0;
      let hh = parseInt(match[1]);
      const mm = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hh !== 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;
      return hh * 60 + mm;
    };
    return timeToMin(a.time) - timeToMin(b.time);
  });
  
  return schedule;
}
