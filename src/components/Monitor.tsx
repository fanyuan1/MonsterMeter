import { useEffect, useRef, useState } from "react";
import type { AudioEngine } from "../audio/AudioEngine";
import { dbToFraction, emotionForLevel, type Emotion } from "../state/settings";
import { Monster } from "./Monster";

interface Props {
  engine: AudioEngine;
  running: boolean;
  starting: boolean;
  error: string | null;
  monsterId: string;
  thresholdDb: number;
  /** dB of the most recent threshold breach (null = none yet). */
  mDb: number | null;
  /** Whether M's clip has finished recording and is navigable. */
  mHasClip: boolean;
  onOpenMClip: () => void;
  onStart: () => void;
  onStop: () => void;
}

function levelColor(f: number): string {
  const stops: [number, number, number][] = [
    [34, 197, 94],
    [250, 204, 21],
    [239, 68, 68],
  ];
  let c: number[];
  if (f < 0.5) {
    const t = f / 0.5;
    c = stops[0].map((v, i) => v + (stops[1][i] - v) * t);
  } else {
    const t = (f - 0.5) / 0.5;
    c = stops[1].map((v, i) => v + (stops[2][i] - v) * t);
  }
  return `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`;
}

export function Monitor({
  engine,
  running,
  starting,
  error,
  monsterId,
  thresholdDb,
  mDb,
  mHasClip,
  onOpenMClip,
  onStart,
  onStop,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const [recording, setRecording] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>("happy");

  // Keep the latest threshold available inside the per-frame callback without
  // resubscribing every render.
  const thresholdRef = useRef(thresholdDb);
  thresholdRef.current = thresholdDb;
  const emotionRef = useRef<Emotion>("happy");

  // Apply each level update straight to the DOM (no React re-render per frame).
  useEffect(() => {
    const unsub = engine.onLevel((db) => {
      const f = dbToFraction(db);
      const color = levelColor(f);
      if (stageRef.current) {
        stageRef.current.style.setProperty("--lvl", f.toFixed(3));
      }
      const n = numberRef.current;
      if (n) {
        n.textContent = String(Math.round(db));
        n.style.color = color;
        n.style.setProperty("--glow", color);
        // Higher levels visibly "jump out" toward the viewer.
        n.style.transform = `scale(${(1 + f * 0.7).toFixed(3)})`;
      }
      // Re-render the monster only when its mood actually changes.
      const next = emotionForLevel(db, thresholdRef.current);
      if (next !== emotionRef.current) {
        emotionRef.current = next;
        setEmotion(next);
      }
    });
    return unsub;
  }, [engine]);

  useEffect(() => engine.onRecStateChange(setRecording), [engine]);

  // Flash the stage red each time the threshold is crossed.
  useEffect(() => {
    return engine.onThreshold(() => {
      const el = flashRef.current;
      if (!el) return;
      el.classList.remove("flash");
      void el.offsetWidth; // restart the animation
      el.classList.add("flash");
    });
  }, [engine]);

  const thresholdFrac = dbToFraction(thresholdDb);
  const tickAngle = 225 + thresholdFrac * 270; // gauge starts at 225deg, sweeps 270deg
  // Position the threshold number just inside the tick, kept upright.
  const tickRad = (tickAngle * Math.PI) / 180;
  const labelR = 41; // % of the stage, from center
  const labelX = 50 + labelR * Math.sin(tickRad);
  const labelY = 50 - labelR * Math.cos(tickRad);

  return (
    <div className="monitor">
      <div className="db-readout">
        <div className="db-number" ref={numberRef}>
          0
        </div>
        <div className="db-unit">dB</div>
      </div>

      <button
        className={`last-danger ${mDb === null ? "empty" : ""} ${mHasClip ? "ready" : ""}`}
        onClick={onOpenMClip}
        disabled={mDb === null}
      >
        {mDb === null ? (
          <span>No danger noise recorded yet</span>
        ) : (
          <>
            <span>
              Last danger noise level recorded: <strong>{mDb} dB</strong>
            </span>
            <span className="go">{mHasClip ? "Tap to hear clip ↗" : "Recording clip…"}</span>
          </>
        )}
      </button>

      <div className={`monster-stage ${emotion === "veryMad" ? "intense" : ""}`} ref={stageRef}>
        <div className="ring" />
        <div className="alert-flash" ref={flashRef} />
        <div className="threshold-tick" style={{ transform: `rotate(${tickAngle}deg)` }}>
          <div className="tick" />
        </div>
        <div className="tick-num" style={{ left: `${labelX}%`, top: `${labelY}%` }}>
          {Math.round(thresholdDb)}
        </div>
        <div className="monster-inner">
          <Monster id={monsterId} emotion={running ? emotion : "happy"} />
        </div>

        {!running && (
          <div className="start-overlay">
            {error ? (
              <>
                <div style={{ fontSize: 40 }}>🚫</div>
                <div className="hint">{error}</div>
                <button className="btn" onClick={onStart}>
                  Try again
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }}>🎤</div>
                <button className="btn" onClick={onStart} disabled={starting}>
                  {starting ? "Starting…" : "Start listening"}
                </button>
                <div className="hint">Grant microphone access to wake the monster.</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="monitor-footer">
        <span className={recording ? "rec-badge" : "rec-badge idle"}>
          <span className="dot" />
          {recording ? "Recording clip…" : "Armed"}
        </span>
        {running && (
          <button className="btn stop" onClick={onStop}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
