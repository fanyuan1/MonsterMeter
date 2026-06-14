import nileUrl from "../assets/nile-danger.m4a";
import type { Settings } from "../state/settings";
import type { SoundSpec } from "./alert";

export interface SoundOption {
  id: string;
  name: string;
}

/** Selectable built-in sounds. `nile` plays a bundled audio file. */
export const BUILTIN_SOUNDS: SoundOption[] = [
  { id: "siren", name: "Siren" },
  { id: "beep", name: "Beep" },
  { id: "nile", name: "Nile" },
];

/** Resolve a sound id (built-in or custom) to something playable. */
export function resolveSound(id: string, settings: Settings): SoundSpec | null {
  if (id === "siren") return { kind: "siren" };
  if (id === "beep") return { kind: "beep" };
  if (id === "nile") return { kind: "file", url: nileUrl };
  const custom = settings.customSounds.find((c) => c.id === id);
  return custom ? { kind: "file", url: custom.dataUrl } : null;
}

/** Resolve all selected sounds to playable specs. */
export function resolveSounds(settings: Settings): SoundSpec[] {
  return settings.alertSounds
    .map((id) => resolveSound(id, settings))
    .filter((s): s is SoundSpec => s !== null);
}
