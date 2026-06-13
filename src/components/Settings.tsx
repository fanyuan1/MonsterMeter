import type { AlertType, Settings as SettingsType } from "../state/settings";
import { previewAlert } from "../audio/alert";
import { MONSTERS, Monster } from "./Monster";

const ALERT_TYPES: { id: AlertType; label: string }[] = [
  { id: "speech", label: "Speak" },
  { id: "siren", label: "Siren" },
  { id: "beep", label: "Beep" },
];

interface Props {
  settings: SettingsType;
  onChange: (patch: Partial<SettingsType>) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <div className="label">
        <span>{label}</span>
        <span className="val">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Settings({ settings, onChange }: Props) {
  return (
    <div>
      <div className="card">
        <h2>Pick your monster</h2>
        <p className="sub">The meter's mood reacts to how loud it gets.</p>
        <div className="monster-grid">
          {MONSTERS.map((m) => (
            <button
              key={m.id}
              className={`monster-card ${settings.monsterId === m.id ? "selected" : ""}`}
              onClick={() => onChange({ monsterId: m.id })}
            >
              <div className="thumb">
                <Monster id={m.id} />
              </div>
              <span className="name">{m.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Trigger</h2>
        <p className="sub">When the level crosses this, a clip starts recording.</p>
        <Slider
          label="Threshold"
          value={settings.thresholdDb}
          min={50}
          max={120}
          step={1}
          unit=" dB"
          onChange={(v) => onChange({ thresholdDb: v })}
        />
      </div>

      <div className="card">
        <div className="alert-head">
          <div>
            <h2>Threshold alert</h2>
            <p className="sub" style={{ margin: 0 }}>
              Play a sound the moment the level crosses the threshold.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.alertEnabled}
              onChange={(e) => onChange({ alertEnabled: e.target.checked })}
            />
            <span className="track" />
          </label>
        </div>

        {settings.alertEnabled && (
          <div style={{ marginTop: 16 }}>
            <div className="seg">
              {ALERT_TYPES.map((a) => (
                <button
                  key={a.id}
                  className={settings.alertType === a.id ? "active" : ""}
                  onClick={() => onChange({ alertType: a.id })}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {settings.alertType === "speech" && (
              <div className="field" style={{ marginTop: 16 }}>
                <div className="label">
                  <span>Phrase</span>
                </div>
                <input
                  type="text"
                  className="text-input"
                  value={settings.alertPhrase}
                  maxLength={60}
                  placeholder="Danger danger"
                  onChange={(e) => onChange({ alertPhrase: e.target.value })}
                />
              </div>
            )}

            <div className="field" style={{ marginTop: 16 }}>
              <div className="label">
                <span>Volume</span>
                <span className="val">{Math.round(settings.alertVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.alertVolume}
                onChange={(e) => onChange({ alertVolume: Number(e.target.value) })}
              />
            </div>

            <button
              className="btn ghost"
              style={{ width: "100%" }}
              onClick={() =>
                previewAlert({
                  type: settings.alertType,
                  phrase: settings.alertPhrase || "Danger danger",
                  volume: settings.alertVolume,
                })
              }
            >
              ▶ Test alert
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>Clip length</h2>
        <p className="sub">
          Audio is kept from before <em>and</em> after the noise. Each new trigger pushes the
          end forward, so sustained noise makes a longer clip.
        </p>
        <Slider
          label="Pre-roll (before)"
          value={settings.preRollSec}
          min={0}
          max={15}
          step={0.5}
          unit=" s"
          onChange={(v) => onChange({ preRollSec: v })}
        />
        <Slider
          label="Post-roll (after, resets per trigger)"
          value={settings.postRollSec}
          min={0.5}
          max={20}
          step={0.5}
          unit=" s"
          onChange={(v) => onChange({ postRollSec: v })}
        />
      </div>

      <div className="card">
        <h2>Calibration</h2>
        <p className="sub">
          Phones have no true SPL reference. Nudge this so the displayed number matches a real
          sound‑level meter (higher = reads louder).
        </p>
        <Slider
          label="Offset"
          value={settings.calibrationDb}
          min={60}
          max={120}
          step={1}
          unit=" dB"
          onChange={(v) => onChange({ calibrationDb: v })}
        />
      </div>
    </div>
  );
}
