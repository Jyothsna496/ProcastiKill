// ProcastiKill - Ambient Sounds & Speech Modulator
import { state, saveState } from './state.js';

let audioCtx = null;
let activeOscillators = [];
let noiseNode = null;
let recognition = null;
let isRecording = false;

// Voice Alerts (SpeechSynthesis)
export function speakText(text) {
  if (!state.soundOn) return;
  try {
    window.speechSynthesis.cancel(); // Stop current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1.0;
    utterance.rate = 1.05;
    
    // Attempt to pick a clean English voice if available
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Natural')));
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }
    
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error('Speech synthesis failure:', e);
  }
}

// STT Speech-to-Text (Voice Panic Input)
export function initSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('STT SpeechRecognition is not supported in this browser.');
    return;
  }
  
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  
  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        transcript += event.results[i][0].transcript;
      }
    }
    const txtArea = document.getElementById('crisis-desc');
    if (txtArea && transcript) {
      txtArea.value += (txtArea.value ? ' ' : '') + transcript;
      // Trigger input event to update char counts or sliders if any
      txtArea.dispatchEvent(new Event('input'));
    }
  };
  
  recognition.onerror = (e) => {
    console.error('Speech recognition error:', e);
    toggleDictationUI(false);
  };
  
  recognition.onend = () => {
    toggleDictationUI(false);
  };
}

export function toggleDictation() {
  if (!recognition) {
    initSTT();
  }
  if (!recognition) {
    alert('Voice recognition is not supported in your browser. Please try Chrome or Safari.');
    return;
  }
  
  if (isRecording) {
    recognition.stop();
    toggleDictationUI(false);
  } else {
    try {
      recognition.start();
      toggleDictationUI(true);
    } catch(e) {
      console.error('STT Start Error:', e);
    }
  }
}

function toggleDictationUI(active) {
  isRecording = active;
  const btn = document.getElementById('btn-voice-input');
  const icon = document.getElementById('voice-input-icon');
  if (btn && icon) {
    if (active) {
      btn.classList.add('bg-red-50', 'border-red-300', 'text-red-600');
      icon.classList.remove('text-secondaryText');
      icon.classList.add('text-red-500', 'animate-pulse');
    } else {
      btn.classList.remove('bg-red-50', 'border-red-300', 'text-red-600');
      icon.classList.add('text-secondaryText');
      icon.classList.remove('text-red-500', 'animate-pulse');
    }
  }
}

// Web Audio API Synthesizers
export function stopAmbientSound() {
  if (activeOscillators.length > 0) {
    activeOscillators.forEach(osc => {
      try { osc.stop(); } catch(e){}
    });
    activeOscillators = [];
  }
  if (noiseNode) {
    try { noiseNode.stop(); } catch(e){}
    noiseNode = null;
  }
  state.activeSoundMode = null;
  updateSoundUI();
}

export function startAmbientSound(mode) {
  stopAmbientSound();
  
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  state.activeSoundMode = mode;
  
  try {
    if (mode === 'cyber') {
      // Cyber Focus: 55Hz low-pass sawtooth drone
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      
      filter.type = 'lowpass';
      filter.frequency.value = 105;
      
      gain.gain.value = 0.08;
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      activeOscillators.push(osc);
      
    } else if (mode === 'binaural') {
      // Binaural Gamma Beat: Stereo-panned 220Hz/260Hz sine waves (40Hz beat)
      const oscL = audioCtx.createOscillator();
      const oscR = audioCtx.createOscillator();
      const panL = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
      const panR = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
      const gain = audioCtx.createGain();
      
      oscL.type = 'sine';
      oscL.frequency.value = 220;
      oscR.type = 'sine';
      oscR.frequency.value = 260;
      
      gain.gain.value = 0.05;
      
      if (panL && panR) {
        panL.pan.value = -1;
        panR.pan.value = 1;
        oscL.connect(panL).connect(gain);
        oscR.connect(panR).connect(gain);
      } else {
        oscL.connect(gain);
        oscR.connect(gain);
      }
      
      oscL.start();
      oscR.start();
      activeOscillators.push(oscL, oscR);
      
    } else if (mode === 'cosmic') {
      // Cosmic Drone: Detuned low sine + triangle waves with volume modulation (LFO)
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.value = 110;
      osc2.type = 'triangle';
      osc2.frequency.value = 110.5;
      
      lfo.type = 'sine';
      lfo.frequency.value = 0.08; // extremely slow breathing rhythm
      
      lfoGain.gain.value = 0.03;
      gain.gain.value = 0.06;
      
      osc1.connect(gain);
      osc2.connect(gain);
      lfo.connect(lfoGain).connect(gain.gain);
      
      gain.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();
      lfo.start();
      activeOscillators.push(osc1, osc2, lfo);
      
    } else if (mode === 'rain') {
      // White Rain: Noise buffer + bandpass sweeping filter
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      
      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;
      filter.Q.value = 1.2;
      
      const gain = audioCtx.createGain();
      gain.gain.value = 0.08;
      
      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      
      whiteNoise.start();
      noiseNode = whiteNoise;
    }
  } catch (err) {
    console.error('Audio synthesizer initiation failure:', err);
  }
  
  updateSoundUI();
}

export function updateSoundUI() {
  const modes = ['cyber', 'binaural', 'cosmic', 'rain'];
  modes.forEach(m => {
    const btn = document.getElementById(`sound-${m}`);
    const dot = document.getElementById(`dot-${m}`);
    if (btn && dot) {
      if (state.activeSoundMode === m) {
        btn.classList.add('bg-primary', 'text-white', 'border-primary');
        btn.classList.remove('bg-white', 'text-bodyText', 'border-borderLight');
        dot.classList.remove('hidden');
        dot.classList.add('bg-cyan-300', 'animate-ping');
      } else {
        btn.classList.remove('bg-primary', 'text-white', 'border-primary');
        btn.classList.add('bg-white', 'text-bodyText', 'border-borderLight');
        dot.classList.add('hidden');
        dot.classList.remove('bg-cyan-300', 'animate-ping');
      }
    }
  });
}
