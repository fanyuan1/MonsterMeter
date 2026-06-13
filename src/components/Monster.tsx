import { useEffect, useRef, useState } from "react";
import type { Emotion } from "../state/settings";

/**
 * Real artwork assets, if present. Drop files into `src/assets/monsters/`
 * named `<id>-<mood>.png` (e.g. `bloomhorn-verymad.png`). Per-mood files give
 * the full happy→veryMad range; a single `<id>.png` is used for every mood as
 * a fallback. When no file exists, the hand-built SVG below is used instead.
 * See src/assets/monsters/README.md.
 */
const assetModules = import.meta.glob("../assets/monsters/*.{png,webp,jpg,jpeg,gif,svg}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const MONSTER_ASSETS: Record<string, string> = {};
for (const path in assetModules) {
  const key = path
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  MONSTER_ASSETS[key] = assetModules[path];
}

const MOOD_FILE: Record<Emotion, string> = {
  happy: "happy",
  indifferent: "indifferent",
  mad: "mad",
  veryMad: "verymad",
};

/** Returns the artwork URL for a monster+mood, or null if none is provided. */
function monsterAsset(id: string, emotion: Emotion): string | null {
  return MONSTER_ASSETS[`${id}-${MOOD_FILE[emotion]}`] ?? MONSTER_ASSETS[id] ?? null;
}

export interface MonsterDef {
  id: string;
  name: string;
  /** Accent color used in chips / selection. */
  color: string;
}

export const MONSTERS: MonsterDef[] = [
  { id: "wingwurm", name: "Wingwurm", color: "#d85c4f" },
  { id: "aquaeye", name: "Aqua-eye", color: "#2f6d99" },
  { id: "thunderpuff", name: "Thunderpuff", color: "#9b86c8" },
  { id: "finnysnout", name: "Finny snout", color: "#e6c14a" },
];

export function getMonster(id: string): MonsterDef {
  return MONSTERS.find((m) => m.id === id) ?? MONSTERS[0];
}

const INK = "#3f3147";
const ANGER = "#e5484d";

/* ------------------------------------------------------------------ */
/* Shared facial-feature helpers, parameterised by position + emotion */
/* ------------------------------------------------------------------ */

/** A pair of round/expressive eyes. */
function EyePair({
  e,
  lx,
  rx,
  y,
  r = 12,
}: {
  e: Emotion;
  lx: number;
  rx: number;
  y: number;
  r?: number;
}) {
  if (e === "happy") {
    return (
      <g fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round">
        <path d={`M${lx - r} ${y + 2} Q ${lx} ${y - r} ${lx + r} ${y + 2}`} />
        <path d={`M${rx - r} ${y + 2} Q ${rx} ${y - r} ${rx + r} ${y + 2}`} />
      </g>
    );
  }
  const pupil = e === "veryMad" ? ANGER : INK;
  const eye = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth={2} />
      <circle cx={cx} cy={y + (e === "indifferent" ? 0 : 2)} r={r * 0.5} fill={pupil} />
    </g>
  );
  const brow = (cx: number, mirror: boolean) => {
    if (e !== "mad" && e !== "veryMad") return null;
    const steep = e === "veryMad" ? 9 : 5;
    const outer = mirror ? cx + r + 3 : cx - r - 3;
    const inner = mirror ? cx - r + 2 : cx + r - 2;
    return (
      <line
        key={`b${cx}`}
        x1={outer}
        y1={y - r - 1}
        x2={inner}
        y2={y - r + steep}
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
    );
  };
  return (
    <g>
      {eye(lx)}
      {eye(rx)}
      {brow(lx, false)}
      {brow(rx, true)}
    </g>
  );
}

/** A mouth that morphs across the four moods. */
function Mouth({
  e,
  cx,
  cy,
  w = 26,
  color = INK,
}: {
  e: Emotion;
  cx: number;
  cy: number;
  w?: number;
  color?: string;
}) {
  const h = w / 2;
  switch (e) {
    case "happy":
      return (
        <path
          d={`M${cx - h} ${cy} Q ${cx} ${cy + h} ${cx + h} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
    case "indifferent":
      return (
        <line
          x1={cx - h}
          y1={cy}
          x2={cx + h}
          y2={cy}
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
    case "mad":
      return (
        <path
          d={`M${cx - h} ${cy + 5} Q ${cx} ${cy - h * 0.5} ${cx + h} ${cy + 5}`}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
    case "veryMad":
      return (
        <g>
          <path
            d={`M${cx - h} ${cy - 3} Q ${cx} ${cy + h + 2} ${cx + h} ${cy - 3} Z`}
            fill="#7a1e2b"
            stroke={color}
            strokeWidth={2}
          />
          <path
            d={`M${cx - h + 3} ${cy - 2} l5 6 l5 -6 l5 6 l5 -6 l5 6 l5 -6`}
            fill="#fff"
          />
        </g>
      );
  }
}

/** Translucent red flush, shown only when furious. */
function Flush({ e, cx, cy, rx, ry }: { e: Emotion; cx: number; cy: number; rx: number; ry: number }) {
  if (e !== "veryMad") return null;
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={ANGER} opacity={0.28} />;
}

/** Manga-style anger vein for mad / veryMad. */
function Vein({ e, x, y }: { e: Emotion; x: number; y: number }) {
  if (e !== "mad" && e !== "veryMad") return null;
  return (
    <g transform={`translate(${x} ${y})`} stroke={ANGER} strokeWidth={2.4} strokeLinecap="round" fill="none">
      <path d="M0 4 L10 0 M10 0 L8 11 M3 9 L13 5 M13 5 L11 16" />
    </g>
  );
}

/** Lightning bolt (Thunderpuff fury). */
function Bolt({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${flip ? -1 : 1}, 1)`}
      d="M2 0 L-6 14 L0 14 L-4 28 L10 8 L3 8 L9 0 Z"
      fill="#f7d44c"
      stroke={INK}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  );
}

const svgProps = {
  viewBox: "0 0 200 210",
  width: "100%",
  height: "100%",
  preserveAspectRatio: "xMidYMid meet",
} as const;

/* ------------------------------------------------------------------ */
/* SVG fallbacks (used only if a monster's artwork asset is missing)   */
/* ------------------------------------------------------------------ */

function Wingwurm({ e }: { e: Emotion }) {
  return (
    <svg {...svgProps} className="monster">
      <g className="m-body">
        {/* wings */}
        <path d="M64 104 C 22 74 16 124 40 134 C 20 144 40 168 66 148 Z" fill="#d85c4f" stroke={INK} strokeWidth={2.5} />
        <path d="M136 104 C 178 74 184 124 160 134 C 180 144 160 168 134 148 Z" fill="#d85c4f" stroke={INK} strokeWidth={2.5} />
        {/* antennae */}
        <path d="M88 54 C 82 30 78 22 72 16" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d="M112 54 C 118 30 122 22 128 16" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <circle cx="72" cy="14" r="4.5" fill="#d8b48a" stroke={INK} strokeWidth={2} />
        <circle cx="128" cy="14" r="4.5" fill="#d8b48a" stroke={INK} strokeWidth={2} />
        {/* body */}
        <path
          d="M100 48 C 128 48 134 84 128 112 C 122 142 142 156 124 178 C 112 192 92 188 92 172 C 92 152 72 150 72 110 C 72 74 80 48 100 48 Z"
          fill="#d8b48a"
          stroke={INK}
          strokeWidth={3}
        />
        <ellipse cx="100" cy="120" rx="20" ry="44" fill="#ecd9bf" />
        <Flush e={e} cx={100} cy={104} rx={30} ry={48} />
        {/* face */}
        <EyePair e={e} lx={88} rx={112} y={92} r={11} />
        <Mouth e={e} cx={100} cy={124} w={22} />
        <Vein e={e === "mad" ? "indifferent" : e} x={120} y={70} />
      </g>
    </svg>
  );
}

function AquaEye({ e }: { e: Emotion }) {
  // Single-eye monster: custom face.
  const lid = e === "mad" || e === "veryMad";
  return (
    <svg {...svgProps} className="monster">
      <g className="m-body">
        {/* fins */}
        <path d="M50 120 q-32 -10 -36 6 q22 4 30 16 q-20 2 -26 16 q26 4 36 -12 Z" fill="#5aa6c9" stroke={INK} strokeWidth={2} />
        <path d="M150 120 q32 -10 36 6 q-22 4 -30 16 q20 2 26 16 q-26 4 -36 -12 Z" fill="#5aa6c9" stroke={INK} strokeWidth={2} />
        {/* body */}
        <path
          d="M100 50 C 150 50 162 96 158 132 C 152 182 122 194 100 194 C 78 194 48 182 42 132 C 38 96 50 50 100 50 Z"
          fill="#2f6d99"
          stroke={INK}
          strokeWidth={3}
        />
        <Flush e={e} cx={100} cy={120} rx={58} ry={68} />
        {/* big single eye */}
        <circle cx="100" cy="108" r="38" fill="#fff" stroke={INK} strokeWidth={3} />
        {e === "happy" ? (
          <path d="M76 110 Q 100 86 124 110" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        ) : (
          <circle cx="100" cy={e === "indifferent" ? 108 : 112} r="16" fill={e === "veryMad" ? ANGER : INK} />
        )}
        {lid && (
          <path
            d="M62 96 L138 76 L138 70 L62 90 Z"
            fill="#2f6d99"
            stroke={INK}
            strokeWidth={2}
          />
        )}
        {/* mouth + fang */}
        <Mouth e={e} cx={100} cy={162} w={24} />
        <path d="M92 160 l4 12 l4 -12 z" fill="#fff" stroke={INK} strokeWidth={1.4} />
      </g>
    </svg>
  );
}

function Thunderpuff({ e }: { e: Emotion }) {
  const tufts: string[] = [];
  const cx = 100;
  const cy = 116;
  const n = 30;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = ((i + 0.5) / n) * Math.PI * 2;
    const a3 = ((i + 1) / n) * Math.PI * 2;
    const r1 = 56;
    const r2 = 68;
    tufts.push(
      `M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1} L ${cx + Math.cos(a2) * r2} ${
        cy + Math.sin(a2) * r2
      } L ${cx + Math.cos(a3) * r1} ${cy + Math.sin(a3) * r1} Z`
    );
  }
  return (
    <svg {...svgProps} className="monster">
      <g className="m-body">
        {/* legs + striped socks */}
        <rect x="80" y="168" width="9" height="26" rx="4" fill="#8a74bb" stroke={INK} strokeWidth={2} />
        <rect x="111" y="168" width="9" height="26" rx="4" fill="#8a74bb" stroke={INK} strokeWidth={2} />
        <rect x="77" y="182" width="15" height="16" rx="4" fill="#fff" stroke={INK} strokeWidth={2} />
        <rect x="108" y="182" width="15" height="16" rx="4" fill="#fff" stroke={INK} strokeWidth={2} />
        <line x1="77" y1="188" x2="92" y2="188" stroke="#7cc0d8" strokeWidth={2.5} />
        <line x1="108" y1="188" x2="123" y2="188" stroke="#f0a0bd" strokeWidth={2.5} />
        {/* fuzzy body */}
        <path d={tufts.join(" ")} fill="#9b86c8" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
        <circle cx={cx} cy={cy} r={56} fill="#9b86c8" stroke={INK} strokeWidth={2} />
        <Flush e={e} cx={cx} cy={cy} rx={54} ry={54} />
        {/* face */}
        <EyePair e={e} lx={84} rx={116} y={112} r={11} />
        <Mouth e={e} cx={100} cy={140} w={22} />
        {e === "veryMad" && (
          <>
            <Bolt x={30} y={70} />
            <Bolt x={170} y={70} flip />
          </>
        )}
      </g>
    </svg>
  );
}

function FinnySnout({ e }: { e: Emotion }) {
  return (
    <svg {...svgProps} className="monster">
      <g className="m-body">
        {/* wing */}
        <path d="M150 108 C 184 96 194 110 192 120 C 182 122 168 122 160 120 C 176 128 184 138 182 150 C 160 150 144 134 142 116 Z" fill="#e6c14a" stroke={INK} strokeWidth={2} />
        {/* body */}
        <path
          d="M126 88 C 162 88 172 126 166 158 C 161 184 140 192 120 190 C 96 188 90 160 96 138 C 100 120 108 88 126 88 Z"
          fill="#f3d04e"
          stroke={INK}
          strokeWidth={3}
        />
        {/* long snout pointing left */}
        <path
          d="M104 116 C 64 112 34 120 16 128 C 32 140 64 146 104 140 Z"
          fill="#f3d04e"
          stroke={INK}
          strokeWidth={3}
        />
        {/* head tuft */}
        <path d="M120 70 q-4 -22 8 -30 q-2 16 6 24 z" fill="#e6c14a" stroke={INK} strokeWidth={2} />
        <Flush e={e} cx={122} cy={130} rx={42} ry={52} />
        {/* eyes high on head */}
        <EyePair e={e} lx={116} rx={136} y={92} r={10} />
        {/* mouth: the snout line, plus fangs when furious */}
        <Mouth e={e} cx={70} cy={132} w={24} />
        {e === "veryMad" && (
          <>
            <path d="M40 130 l3 9 l3 -9 z" fill="#fff" stroke={INK} strokeWidth={1.2} />
            <path d="M58 132 l3 9 l3 -9 z" fill="#fff" stroke={INK} strokeWidth={1.2} />
          </>
        )}
        {e === "veryMad" && (
          <g stroke="#fff" strokeWidth={2} strokeLinecap="round">
            <line x1="158" y1="64" x2="158" y2="76" />
            <line x1="152" y1="70" x2="164" y2="70" />
          </g>
        )}
      </g>
    </svg>
  );
}

/** Hand-built SVG fallback, used only when no artwork asset is provided. */
function MonsterSvg({ id, emotion }: { id: string; emotion: Emotion }) {
  switch (id) {
    case "aquaeye":
      return <AquaEye e={emotion} />;
    case "thunderpuff":
      return <Thunderpuff e={emotion} />;
    case "finnysnout":
      return <FinnySnout e={emotion} />;
    default:
      return <Wingwurm e={emotion} />;
  }
}

/**
 * Stacks artwork layers and fades a new one in over the old, so mood changes
 * ease rather than snap. Older layers are pruned once the newest finishes.
 */
function CrossfadeImage({ url, alt }: { url: string; alt: string }) {
  const [layers, setLayers] = useState<{ url: string; k: number }[]>([{ url, k: 0 }]);
  const kRef = useRef(0);

  useEffect(() => {
    setLayers((prev) => {
      if (prev[prev.length - 1].url === url) return prev;
      kRef.current += 1;
      return [...prev, { url, k: kRef.current }];
    });
  }, [url]);

  return (
    <div className="monster monster-img">
      {layers.map((l, i) => {
        const isTop = i === layers.length - 1;
        return (
          <img
            key={l.k}
            src={l.url}
            alt={alt}
            draggable={false}
            className={isTop && layers.length > 1 ? "xfade-enter" : ""}
            onAnimationEnd={
              isTop
                ? () => setLayers((prev) => (prev[prev.length - 1].k === l.k ? [l] : prev))
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

export function Monster({ id, emotion = "happy" }: { id: string; emotion?: Emotion }) {
  const url = monsterAsset(id, emotion);
  if (url) {
    return <CrossfadeImage url={url} alt={`${getMonster(id).name} (${emotion})`} />;
  }
  return <MonsterSvg id={id} emotion={emotion} />;
}
