import type { ChangeEvent } from "react";
import type { Settings as SettingsType } from "../state/settings";
import { previewAlert } from "../audio/alert";
import { BUILTIN_SOUNDS, resolveSounds } from "../audio/sounds";
import { MONSTERS, Monster } from "./Monster";

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
  const toggleSound = (id: string) => {
    const sel = settings.alertSounds.includes(id)
      ? settings.alertSounds.filter((s) => s !== id)
      : [...settings.alertSounds, id];
    onChange({ alertSounds: sel });
  };

  const removeCustom = (id: string) => {
    onChange({
      customSounds: settings.customSounds.filter((c) => c.id !== id),
      alertSounds: settings.alertSounds.filter((s) => s !== id),
    });
  };

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `custom-${Date.now().toString(36)}`;
      const name = (file.name.replace(/\.[^.]+$/, "") || "Custom").slice(0, 20);
      onChange({
        customSounds: [...settings.customSounds, { id, name, dataUrl: String(reader.result) }],
        alertSounds: [...settings.alertSounds, id],
      });
    };
    reader.readAsDataURL(file);
  };

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
            <div className="field">
              <div className="label">
                <span>Phrase (spoken)</span>
              </div>
              <input
                type="text"
                className="text-input"
                value={settings.alertPhrase}
                maxLength={80}
                placeholder="Leave blank for no speech"
                onChange={(e) => onChange({ alertPhrase: e.target.value })}
              />
            </div>

            <div className="field">
              <div className="label">
                <span>Sounds</span>
                <span className="val" style={{ color: "var(--muted)", fontWeight: 600 }}>
                  pick any
                </span>
              </div>
              <div className="sound-grid">
                {BUILTIN_SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    className={`sound-chip ${settings.alertSounds.includes(s.id) ? "selected" : ""}`}
                    onClick={() => toggleSound(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
                {settings.customSounds.map((s) => (
                  <span
                    key={s.id}
                    className={`sound-chip ${settings.alertSounds.includes(s.id) ? "selected" : ""}`}
                  >
                    <button className="chip-main" onClick={() => toggleSound(s.id)}>
                      {s.name}
                    </button>
                    <button
                      className="chip-x"
                      title="Remove"
                      onClick={() => removeCustom(s.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <label className="sound-chip upload">
                  + Upload
                  <input type="file" accept="audio/*" hidden onChange={onUpload} />
                </label>
              </div>
            </div>

            <div className="field">
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
                  phrase: settings.alertPhrase,
                  volume: settings.alertVolume,
                  sounds: resolveSounds(settings),
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
