import { encodeWav } from "./wav";
import { playAlert } from "./alert";
import type { AlertType } from "../state/settings";

export interface RecordedClip {
  blob: Blob;
  durationSec: number;
  peakDb: number;
  sampleRate: number;
  createdAt: number;
}

export interface EngineConfig {
  thresholdDb: number;
  preRollSec: number;
  postRollSec: number;
  calibrationDb: number;
  alertEnabled: boolean;
  alertType: AlertType;
  alertPhrase: string;
  alertVolume: number;
}

type LevelListener = (db: number) => void;
type RecStateListener = (recording: boolean) => void;
type ClipListener = (clip: RecordedClip) => void;
type ThresholdListener = (db: number) => void;

const PROCESSOR_BUFFER = 4096;
/** Minimum gap between alerts so hovering near the threshold can't spam them. */
const ALERT_COOLDOWN_SEC = 1.2;

/**
 * Owns the microphone graph:
 *   source -> analyser (smooth meter)
 *   source -> processor -> mutedGain -> destination (sample capture + trigger)
 *
 * Keeps a continuous ring buffer of the most recent `preRollSec` of audio so a
 * clip can include sound from *before* the trigger fired. While recording, the
 * post-roll deadline is pushed forward every time the threshold is crossed
 * again, so sustained noise extends the clip rather than cutting it.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mutedGain: GainNode | null = null;

  private cfg: EngineConfig;

  // Ring buffer (pre-roll) of mono Float32 samples.
  private ring = new Float32Array(0);
  private ringWrite = 0;
  private ringFilled = false;

  // Active recording state.
  private recording = false;
  private captureChunks: Float32Array[] = [];
  private recordUntil = 0; // ctx.currentTime deadline
  private capturePeakDb = -Infinity;

  // Threshold-crossing alert state.
  private wasAbove = false;
  private lastAlertAt = -Infinity;

  // Visual meter loop.
  private rafId = 0;
  private analyserBuf = new Float32Array(0);
  private smoothedDb = 0;

  private levelListeners = new Set<LevelListener>();
  private recStateListeners = new Set<RecStateListener>();
  private clipListeners = new Set<ClipListener>();
  private thresholdListeners = new Set<ThresholdListener>();

  running = false;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
  }

  onLevel(fn: LevelListener) {
    this.levelListeners.add(fn);
    return () => {
      this.levelListeners.delete(fn);
    };
  }
  onRecStateChange(fn: RecStateListener) {
    this.recStateListeners.add(fn);
    return () => {
      this.recStateListeners.delete(fn);
    };
  }
  onClip(fn: ClipListener) {
    this.clipListeners.add(fn);
    return () => {
      this.clipListeners.delete(fn);
    };
  }
  /** Fires on the rising edge of a threshold crossing (subject to cooldown). */
  onThreshold(fn: ThresholdListener) {
    this.thresholdListeners.add(fn);
    return () => {
      this.thresholdListeners.delete(fn);
    };
  }

  updateConfig(cfg: EngineConfig) {
    const preRollChanged = cfg.preRollSec !== this.cfg.preRollSec;
    this.cfg = cfg;
    if (preRollChanged && this.ctx) this.allocateRing();
  }

  private allocateRing() {
    if (!this.ctx) return;
    const len = Math.max(1, Math.ceil(this.cfg.preRollSec * this.ctx.sampleRate));
    this.ring = new Float32Array(len);
    this.ringWrite = 0;
    this.ringFilled = false;
  }

  async start() {
    if (this.running) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(this.stream);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;
    this.analyserBuf = new Float32Array(this.analyser.fftSize);
    this.source.connect(this.analyser);

    this.allocateRing();

    this.processor = this.ctx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);
    this.processor.onaudioprocess = this.handleAudioProcess;
    this.mutedGain = this.ctx.createGain();
    this.mutedGain.gain.value = 0; // keep the processor alive without audible feedback
    this.source.connect(this.processor);
    this.processor.connect(this.mutedGain);
    this.mutedGain.connect(this.ctx.destination);

    this.wasAbove = false;
    this.lastAlertAt = -Infinity;
    this.running = true;
    this.loop();
  }

  async stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    if (this.recording) this.finalizeClip();
    this.processor?.disconnect();
    this.analyser?.disconnect();
    this.source?.disconnect();
    this.mutedGain?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close();
    this.ctx = null;
    this.processor = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
  }

  private rmsToDb(rms: number): number {
    if (rms <= 0) return 0;
    const db = 20 * Math.log10(rms) + this.cfg.calibrationDb;
    return Math.max(0, db);
  }

  /** Audio-thread callback: keep the ring filled, capture if recording, detect triggers. */
  private handleAudioProcess = (e: AudioProcessingEvent) => {
    const input = e.inputBuffer.getChannelData(0);
    const n = input.length;

    // Write into ring buffer.
    const ring = this.ring;
    if (ring.length > 0) {
      for (let i = 0; i < n; i++) {
        ring[this.ringWrite] = input[i];
        this.ringWrite++;
        if (this.ringWrite >= ring.length) {
          this.ringWrite = 0;
          this.ringFilled = true;
        }
      }
    }

    // Block RMS -> dB (used for accurate trigger detection).
    let sum = 0;
    for (let i = 0; i < n; i++) sum += input[i] * input[i];
    const db = this.rmsToDb(Math.sqrt(sum / n));

    const now = this.ctx!.currentTime;
    const above = db >= this.cfg.thresholdDb;

    if (above) {
      if (!this.recording) this.startRecording();
      // Extend (or set) the deadline on every trigger.
      this.recordUntil = now + this.cfg.postRollSec;
    }

    // Rising edge: only fire when crossing from below to above, with cooldown.
    if (above && !this.wasAbove && now - this.lastAlertAt >= ALERT_COOLDOWN_SEC) {
      this.lastAlertAt = now;
      this.thresholdListeners.forEach((fn) => fn(db));
      if (this.cfg.alertEnabled) {
        playAlert(this.ctx, {
          type: this.cfg.alertType,
          phrase: this.cfg.alertPhrase,
          volume: this.cfg.alertVolume,
        });
      }
    }
    this.wasAbove = above;

    if (this.recording) {
      this.captureChunks.push(new Float32Array(input)); // copy: buffer is reused
      if (db > this.capturePeakDb) this.capturePeakDb = db;
      if (now >= this.recordUntil) this.finalizeClip();
    }
  };

  private startRecording() {
    this.recording = true;
    this.captureChunks = [];
    this.capturePeakDb = -Infinity;

    // Seed the clip with the pre-roll (ring buffer) in chronological order.
    const ring = this.ring;
    if (ring.length > 0) {
      if (this.ringFilled) {
        this.captureChunks.push(ring.slice(this.ringWrite));
        this.captureChunks.push(ring.slice(0, this.ringWrite));
      } else {
        this.captureChunks.push(ring.slice(0, this.ringWrite));
      }
    }

    this.recStateListeners.forEach((fn) => fn(true));
  }

  private finalizeClip() {
    if (!this.recording || !this.ctx) return;
    this.recording = false;

    const total = this.captureChunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of this.captureChunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    this.captureChunks = [];

    const sampleRate = this.ctx.sampleRate;
    const clip: RecordedClip = {
      blob: encodeWav(merged, sampleRate),
      durationSec: merged.length / sampleRate,
      peakDb: this.capturePeakDb === -Infinity ? 0 : this.capturePeakDb,
      sampleRate,
      createdAt: Date.now(),
    };

    this.recStateListeners.forEach((fn) => fn(false));
    this.clipListeners.forEach((fn) => fn(clip));
  }

  /** Visual meter: smooth dBFS reading via the analyser node. */
  private loop = () => {
    if (!this.running || !this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.analyserBuf);
    let sum = 0;
    for (let i = 0; i < this.analyserBuf.length; i++) {
      sum += this.analyserBuf[i] * this.analyserBuf[i];
    }
    const db = this.rmsToDb(Math.sqrt(sum / this.analyserBuf.length));
    // Fast attack, slower release for a lively-but-readable meter.
    const k = db > this.smoothedDb ? 0.6 : 0.15;
    this.smoothedDb += (db - this.smoothedDb) * k;
    this.levelListeners.forEach((fn) => fn(this.smoothedDb));
    this.rafId = requestAnimationFrame(this.loop);
  };
}
