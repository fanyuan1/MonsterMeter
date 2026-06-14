/** A user-uploaded alert sound, stored inline as a data URL. */
export interface CustomSound {
  id: string;
  name: string;
  dataUrl: string;
}

/** The monster's mood, escalating with the noise level. */
export type Emotion = "happy" | "indifferent" | "mad" | "veryMad";

/**
 * Map the displayed dB to a mood. "veryMad" is reserved for breaching the
 * threshold; below that the band up to the threshold is split happy → mad.
 */
export function emotionForLevel(db: number, thresholdDb: number): Emotion {
  if (db >= thresholdDb) return "veryMad";
  const r = thresholdDb > 0 ? db / thresholdDb : 0;
  if (r >= 0.85) return "mad";
  if (r >= 0.6) return "indifferent";
  return "happy";
}

export interface Settings {
  /** Trigger threshold on the displayed dB scale. */
  thresholdDb: number;
  /** Play a sound effect the moment the level crosses the threshold. */
  alertEnabled: boolean;
  /** Spoken phrase; blank = no speech. */
  alertPhrase: string;
  /** Ids of the selected sounds (built-in or custom). Multiple may play together. */
  alertSounds: string[];
  /** User-uploaded custom sounds. */
  customSounds: CustomSound[];
  /** Alert loudness, 0..1. */
  alertVolume: number;
  /** Seconds of audio kept *before* the trigger. */
  preRollSec: number;
  /** Seconds of audio kept *after* the last trigger (resets on every new trigger). */
  postRollSec: number;
  /**
   * Calibration offset added to the raw dBFS reading to produce the displayed
   * dB value. Web Audio has no absolute SPL reference, so this maps the
   * device's signal level onto a familiar ~0-120 dB scale.
   */
  calibrationDb: number;
  /** Id of the currently selected monster. */
  monsterId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  thresholdDb: 100,
  alertEnabled: true,
  alertPhrase: "",
  alertSounds: ["nile"],
  customSounds: [],
  alertVolume: 0.8,
  preRollSec: 3,
  postRollSec: 3,
  calibrationDb: 100,
  monsterId: "wingwurm",
};

const KEY = "monster-meter-settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode errors */
  }
}

/** Visual scale bounds used for the gauge fill and monster animation. */
export const GAUGE_MIN_DB = 30;
export const GAUGE_MAX_DB = 120;

/** Map a displayed dB value to a 0..1 fraction for visuals. */
export function dbToFraction(db: number): number {
  const f = (db - GAUGE_MIN_DB) / (GAUGE_MAX_DB - GAUGE_MIN_DB);
  return Math.max(0, Math.min(1, f));
}
