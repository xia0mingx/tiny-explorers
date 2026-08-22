/* audio.js — sound effects and spoken prompts.

   Effects are synthesised with WebAudio rather than shipped as files: a handful of
   short tones weigh nothing, never 404, and keep the app fully offline.

   Speech is ON DEMAND ONLY. Nothing in the app speaks by itself; say() is called
   from exactly one place, the speaker button in the prompt bar. sayAuto() is the
   opt-in path for reading instructions aloud automatically, and is gated on the
   off-by-default `autoSpeak` setting.

   A useful side effect: since say() now only ever runs from a tap, it satisfies
   iPadOS's user-gesture requirement by construction. Auto-played speech was the
   fragile case — this is strictly more reliable, not less.

   Two iPadOS constraints shape this module:
   - An AudioContext starts 'suspended' until a real user gesture resumes it, so
     unlock() is wired to the first touch and every play call resumes defensively.
   - speechSynthesis.getVoices() is empty on first call and fills in asynchronously,
     so the voice is chosen lazily on each utterance instead of cached at load.
*/

import { getSettings } from './state.js';

let ctx = null;

function audioCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Call from the first user gesture so later sounds are allowed to play. */
export function unlock() {
  const ac = audioCtx();
  if (!ac) return;
  // A silent one-frame blip is enough to flip iOS out of the suspended state.
  const b = ac.createBuffer(1, 1, 22050);
  const src = ac.createBufferSource();
  src.buffer = b;
  src.connect(ac.destination);
  src.start(0);
}

/** One shaped sine/triangle tone. Attack/decay envelope avoids the click you get
 *  from starting or stopping an oscillator at non-zero amplitude. */
function tone(freq, startAt, dur, { type = 'sine', gain = 0.18 } = {}) {
  const ac = audioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + startAt;
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const NOTES = { C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
                A5: 880.00, B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568.0 };

const EFFECTS = {
  tap:   () => tone(NOTES.E5, 0, 0.09, { gain: 0.1 }),

  // Rising major triad — unmistakably "yes" even to a pre-verbal child.
  correct: () => {
    tone(NOTES.C5, 0, 0.16);
    tone(NOTES.E5, 0.09, 0.16);
    tone(NOTES.G5, 0.18, 0.3);
  },

  // Deliberately NOT a buzzer. Two soft mid tones that read as "hmm, try again"
  // rather than failure — the app has no lose state and the audio shouldn't imply one.
  wrong: () => {
    tone(NOTES.D5, 0, 0.12, { type: 'triangle', gain: 0.09 });
    tone(NOTES.C5, 0.1, 0.16, { type: 'triangle', gain: 0.09 });
  },

  sparkle: () => {
    tone(NOTES.C6, 0, 0.1, { gain: 0.09 });
    tone(NOTES.E6, 0.06, 0.12, { gain: 0.08 });
    tone(NOTES.G6, 0.12, 0.18, { gain: 0.07 });
  },

  celebrate: () => {
    [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6, NOTES.E6, NOTES.G6]
      .forEach((n, i) => tone(n, i * 0.1, 0.42, { gain: 0.15 }));
  },
};

export function sfx(name) {
  if (!getSettings().sound) return;
  EFFECTS[name]?.();
}

/** A five-note major pentatonic (C D E G A) — the standard trick behind
 *  every "kids can't make it sound bad" music toy, since no combination of
 *  these notes is dissonant. Used by the Music Maker free-play toy. */
export const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0];

/** Public one-shot note player. Unlike sfx(), this is NOT gated on the
 *  `sound` setting: it's for toys whose entire point IS making a sound (the
 *  music maker), so muting incidental sound effects elsewhere shouldn't also
 *  silence the one toy where sound is the whole interaction. */
export function playTone(freq, dur = 0.5) {
  tone(freq, 0, dur);
}

/* ── speech ────────────────────────────────────────────────────────────── */

/* Prefer a voice that sounds friendly rather than whichever the OS defaults to.
   These are the common warm en-* voices across iPadOS/macOS/Windows/Android. */
const PREFERRED = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Google UK English Female',
                   'Microsoft Zira', 'Microsoft Aria'];

function chooseVoice() {
  const voices = speechSynthesis.getVoices?.() ?? [];
  if (!voices.length) return null;
  for (const want of PREFERRED) {
    const hit = voices.find((v) => v.name.includes(want));
    if (hit) return hit;
  }
  return voices.find((v) => v.lang?.startsWith('en')) ?? voices[0];
}

/** Speak text aloud. Always available — the caller (the speaker button) is the
 *  only gate this needs, since a tap is itself the permission. Cancels anything
 *  still playing so rapid taps don't stack up a queue that keeps talking long
 *  after the child moved on. */
export function say(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = chooseVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || 'en-US';
    u.rate = 0.85;   // toddlers need the gap between words
    u.pitch = 1.25;  // reads as friendly rather than announcer-ish
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch { /* speech is an enhancement; never let it break a round */ }
}

export function stopSpeech() {
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}

/** Opt-in path for reading instructions aloud automatically, gated on the
 *  off-by-default `autoSpeak` setting. This is the only auto-play speech left
 *  in the app — everything else waits for the speaker button. */
export function sayAuto(text) {
  if (!getSettings().autoSpeak) return;
  say(text);
}

/* Voices arrive asynchronously on most browsers; touching the list early makes
   the first say() more likely to already have a good voice to pick from. */
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
}
