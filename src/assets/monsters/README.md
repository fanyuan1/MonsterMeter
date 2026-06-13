# Monster artwork assets

Drop your real monster art here and the app uses it automatically (replacing the
hand-built SVG fallbacks). No code changes needed — the loader picks up any file
matching `*.png|webp|jpg|jpeg|gif|svg` in this folder at build time.

## Naming convention

Use `<id>-<mood>.<ext>`. The six ids and four moods are fixed:

| Monster      | id            |
| ------------ | ------------- |
| Bloomhorn    | `bloomhorn`   |
| Wingwurm     | `wingwurm`    |
| Aqua-eye     | `aquaeye`     |
| Sprout blob  | `sproutblob`  |
| Thunderpuff  | `thunderpuff` |
| Finny snout  | `finnysnout`  |

Moods: `happy`, `indifferent`, `mad`, `verymad`

### Best — 24 files (full range of expression)

```
bloomhorn-happy.png
bloomhorn-indifferent.png
bloomhorn-mad.png
bloomhorn-verymad.png
wingwurm-happy.png
... (4 per monster, 24 total)
```

### Quick start — 6 files (no expression change)

A single `<id>.png` (e.g. `bloomhorn.png`) is used for *all* moods of that
monster. Good for a fast preview, but the monster won't change face with the
noise level. Per-mood files override this.

## Helper scripts

### From a 2×2 character sheet (easiest)

Drop a single `<name>.png` sheet with the four expressions laid out as
`happy | indifferent` over `mad | very mad`, then run:

```
node scripts/extract-sheets.mjs
```

It strips the (baked) checkerboard background, crops the four cells (skipping any
separator lines between them), trims + centers each on a uniform 512×512 canvas,
writes `<id>-<mood>.png`, and deletes the sheet. The id is the filename with
non-alphanumerics removed (`aqua-eye.png` → `aquaeye`). A "sheet" is any PNG that
isn't already a `-<mood>.png` file.

### From individual files

If you instead drop 4 separate per-mood files, these clean them up
(safe to re-run; they skip already-processed files):

```
node scripts/strip-checkerboard.mjs   # restores transparency if a checker bg got baked in
node scripts/normalize-frames.mjs     # trims + centers every frame on a uniform 512x512 canvas
```

`normalize-frames` is what keeps a monster from changing size/position as its mood
changes. If you export all 4 moods on one identical canvas yourself, you can skip it.

## Image guidelines

- **Full body**, centered in the frame.
- **Transparent background** (PNG/WebP), so the gauge ring shows behind it.
- **Square-ish canvas** and a **consistent size/position across all 4 moods** of
  a monster, so it doesn't jump around when the mood changes.
- ~512–1024 px is plenty; they're displayed small.
