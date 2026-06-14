/** A playable sound: a synth tone or an audio file URL. */
export type SoundSpec = { kind: "siren" } | { kind: "beep" } | { kind: "file"; url: string };

export interface AlertOptions {
  phrase: string; // blank = no speech
  volume: number; // 0..1
  sounds: SoundSpec[];
}

/** Speak a phrase via the Web Speech API (no audio assets needed). */
function speak(phrase: string, volume: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(phrase);
    u.volume = Math.max(0, Math.min(1, volume));
    u.rate = 1.05;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech not available */
  }
}

/** Rising/falling siren sweep. `cycles` sweeps of 0.5s each. */
function playSiren(ctx: AudioContext, volume: number, cycles = 3) {
  const now = ctx.currentTime;
  const dur = cycles * 0.5;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.setValueAtTime(620, now);
  for (let i = 0; i < cycles; i++) {
    const t = now + i * 0.5;
    osc.frequency.linearRampToValueAtTime(1000, t + 0.25);
    osc.frequency.linearRampToValueAtTime(620, t + 0.5);
  }
  gain.gain.setValueAtTime(volume, now);
  gain.gain.setValueAtTime(volume, now + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, now + dur + 0.05);
  osc.start(now);
  osc.stop(now + dur + 0.1);
}

/** Two short urgent beeps. */
function playBeep(ctx: AudioContext, volume: number) {
  const now = ctx.currentTime;
  for (const t of [0, 0.18]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now + t);
    gain.gain.linearRampToValueAtTime(volume, now + t + 0.01);
    gain.gain.setValueAtTime(volume, now + t + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + t + 0.13);
    osc.start(now + t);
    osc.stop(now + t + 0.14);
  }
}

/** Play an audio-file sound (bundled asset or uploaded data URL). */
function playFile(url: string, volume: number) {
  try {
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume));
    void a.play().catch(() => {});
  } catch {
    /* ignore playback errors */
  }
}

/**
 * Play an alert: speak the phrase (if any) and play every selected sound
 * together. Synth tones need an AudioContext; files do not.
 */
export function playAlert(ctx: AudioContext | null, opts: AlertOptions) {
  if (opts.phrase && opts.phrase.trim()) speak(opts.phrase, opts.volume);
  for (const s of opts.sounds) {
    if (s.kind === "siren") {
      if (ctx) playSiren(ctx, opts.volume);
    } else if (s.kind === "beep") {
      if (ctx) playBeep(ctx, opts.volume);
    } else {
      playFile(s.url, opts.volume);
    }
  }
}

// Lazily-created context so the Settings "Test" button works before the mic
// engine is running.
let previewCtx: AudioContext | null = null;

export function previewAlert(opts: AlertOptions) {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!previewCtx) previewCtx = new Ctx();
  if (previewCtx.state === "suspended") previewCtx.resume();
  playAlert(previewCtx, opts);
}
