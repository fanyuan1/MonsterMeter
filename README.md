# Monster Meter 👹

A mobile-first web app that turns your microphone into an animated monster decibel meter — and auto-captures sound clips around loud noises.

Visit -> [Monster Meter](https://monstermeter.yingcredible.net)

## Features

- **Live dB meter** with a big number that *jumps out* (scales/glows) as it gets louder.
- **Circular gauge** behind the monster, green → yellow → red gradient that fills with the level. A white tick marks the trigger threshold.
- **Six animated monsters** (Bloomhorn, Wingwurm, Aqua-eye, Sprout blob, Thunderpuff, Finny snout) that shift through four moods — **happy → indifferent → mad → very mad** — as the noise level rises. "Very mad" triggers when you breach the threshold. Switch monsters in Settings.
- **Smart clip capture**: when the level crosses the threshold, a clip is recorded containing the configurable **pre-roll** (audio from *before* the noise) and **post-roll** (after). Each new trigger while recording **extends** the post-roll, so sustained noise yields one longer clip.
- **Clips tab** to replay, download (WAV), or delete saved clips (stored locally in IndexedDB).
- **Settings** for threshold, pre/post-roll, calibration offset, and monster choice (persisted in localStorage).

## Run

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173`.

### Testing on a phone

Microphone access requires a **secure context** — `localhost` works, but a LAN IP (`http://192.168.x.x`) does **not**. To test on a real phone, expose it over HTTPS, e.g.:

```bash
npx vite --host          # then tunnel it:
npx localtunnel --port 5173   # or: ngrok http 5173, cloudflared, etc.
```

and open the HTTPS URL on the phone.

## How the dB scale works

The Web Audio API has no absolute SPL reference, so the meter computes signal RMS → dBFS and adds a **calibration offset** (default 100) to land on a familiar ~0–120 dB scale. Tune the offset in Settings against a real sound-level meter app if you want accurate readings. Default trigger threshold is **100 dB**.

## Tech

Vite + React + TypeScript. Core audio is in `src/audio/AudioEngine.ts` (a `ScriptProcessorNode` keeps a rolling pre-roll ring buffer; an `AnalyserNode` drives the meter visuals).
