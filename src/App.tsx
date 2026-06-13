import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "./audio/AudioEngine";
import type { RecordedClip } from "./audio/AudioEngine";
import { Monitor } from "./components/Monitor";
import { Clips } from "./components/Clips";
import { Settings } from "./components/Settings";
import { MONSTERS } from "./components/Monster";
import { addClip } from "./storage/clips";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings as SettingsType,
} from "./state/settings";

type Tab = "monitor" | "clips" | "settings";

/** Simple monochrome line icons for the bottom nav (inherit currentColor). */
function NavIcon({ name }: { name: Tab }) {
  const common = {
    className: "ico",
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "monitor") {
    return (
      <svg {...common}>
        <path d="M4 15a8 8 0 0 1 16 0" />
        <path d="M12 15l4-4" />
        <circle cx="12" cy="15" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "clips") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M10 9.5l4.5 2.5-4.5 2.5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <circle cx="9" cy="9" r="2.4" fill="var(--bg)" />
      <circle cx="15" cy="15" r="2.4" fill="var(--bg)" />
    </svg>
  );
}

export function App() {
  const [settings, setSettings] = useState<SettingsType>(() => {
    const s = loadSettings();
    if (!MONSTERS.some((m) => m.id === s.monsterId)) s.monsterId = DEFAULT_SETTINGS.monsterId;
    return s;
  });
  const [tab, setTab] = useState<Tab>("monitor");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipsKey, setClipsKey] = useState(0);

  // "M": the dB of the most recent threshold breach, and the clip it belongs to.
  const [mDb, setMDb] = useState<number | null>(null);
  const [mClipId, setMClipId] = useState<string | null>(null);
  const [highlightClipId, setHighlightClipId] = useState<string | null>(null);
  // True between a breach and its clip being saved (clip still recording).
  const awaitingMClip = useRef(false);

  // One engine instance for the app's lifetime.
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine({ ...DEFAULT_SETTINGS });
  }
  const engine = engineRef.current;

  // Persist newly recorded clips.
  useEffect(() => {
    return engine.onClip(async (clip: RecordedClip) => {
      const id = `${clip.createdAt}-${Math.random().toString(36).slice(2, 8)}`;
      await addClip({
        id,
        blob: clip.blob,
        durationSec: clip.durationSec,
        peakDb: clip.peakDb,
        createdAt: clip.createdAt,
      });
      // This clip contains the most recent breach(es) -> link it to M.
      if (awaitingMClip.current) {
        awaitingMClip.current = false;
        setMClipId(id);
      }
      setClipsKey((k) => k + 1);
    });
  }, [engine]);

  // Track the last threshold breach for the "M" readout.
  useEffect(() => {
    return engine.onThreshold((db) => {
      setMDb(Math.round(db));
      setMClipId(null); // clip is still recording; not navigable yet
      awaitingMClip.current = true;
    });
  }, [engine]);

  // Keep the engine config in sync with settings.
  useEffect(() => {
    engine.updateConfig({
      thresholdDb: settings.thresholdDb,
      preRollSec: settings.preRollSec,
      postRollSec: settings.postRollSec,
      calibrationDb: settings.calibrationDb,
      alertEnabled: settings.alertEnabled,
      alertType: settings.alertType,
      alertPhrase: settings.alertPhrase,
      alertVolume: settings.alertVolume,
    });
    saveSettings(settings);
  }, [engine, settings]);

  useEffect(() => {
    return () => {
      engine.stop();
    };
  }, [engine]);

  const updateSettings = useCallback((patch: Partial<SettingsType>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      await engine.start();
      setRunning(true);
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in your browser settings."
          : e?.name === "NotFoundError"
          ? "No microphone found on this device."
          : "Could not access the microphone. (Mic needs HTTPS or localhost.)";
      setError(msg);
    } finally {
      setStarting(false);
    }
  }, [engine]);

  const handleStop = useCallback(async () => {
    await engine.stop();
    setRunning(false);
    setClipsKey((k) => k + 1); // a clip may have been flushed on stop
  }, [engine]);

  // Clicking "M" jumps to the Clips tab and highlights the matching clip.
  const handleOpenMClip = useCallback(() => {
    setTab("clips");
    if (mClipId) setHighlightClipId(mClipId);
  }, [mClipId]);

  return (
    <div className="app">
      <div className="topbar">
        <h1>
          Monster<span className="accent"> Meter</span>
        </h1>
      </div>

      <div className="screen">
        {tab === "monitor" && (
          <Monitor
            engine={engine}
            running={running}
            starting={starting}
            error={error}
            monsterId={settings.monsterId}
            thresholdDb={settings.thresholdDb}
            mDb={mDb}
            mHasClip={mClipId !== null}
            onOpenMClip={handleOpenMClip}
            onStart={handleStart}
            onStop={handleStop}
          />
        )}
        {tab === "clips" && (
          <Clips
            refreshKey={clipsKey}
            highlightClipId={highlightClipId}
            onHighlightDone={() => setHighlightClipId(null)}
          />
        )}
        {tab === "settings" && <Settings settings={settings} onChange={updateSettings} />}
      </div>

      <nav className="nav">
        <button className={tab === "monitor" ? "active" : ""} onClick={() => setTab("monitor")}>
          <NavIcon name="monitor" />
          Monitor
        </button>
        <button className={tab === "clips" ? "active" : ""} onClick={() => setTab("clips")}>
          <NavIcon name="clips" />
          Clips
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          <NavIcon name="settings" />
          Settings
        </button>
      </nav>
    </div>
  );
}
