import { useEffect, useMemo, useRef, useState } from "react";
import type { StoredClip } from "../storage/clips";
import { deleteClip, getAllClips } from "../storage/clips";

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec.toFixed(0)}s`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ClipRow({
  clip,
  onDelete,
  highlight,
  onHighlightDone,
}: {
  clip: StoredClip;
  onDelete: (id: string) => void;
  highlight: boolean;
  onHighlightDone: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(clip.blob), [clip.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(onHighlightDone, 2000);
    return () => clearTimeout(t);
  }, [highlight, onHighlightDone]);

  return (
    <div className={`clip ${highlight ? "highlight" : ""}`} ref={rowRef}>
      <div className="clip-head">
        <span className="clip-title">{fmtDate(clip.createdAt)}</span>
        <span className="peak">{Math.round(clip.peakDb)} dB peak</span>
      </div>
      <div className="clip-meta">{fmtDuration(clip.durationSec)} • WAV</div>
      <audio controls preload="none" src={url} />
      <div className="clip-actions">
        <a href={url} download={`monster-clip-${clip.createdAt}.wav`}>
          ⬇ Download
        </a>
        <button className="danger" onClick={() => onDelete(clip.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

export function Clips({
  refreshKey,
  highlightClipId,
  onHighlightDone,
}: {
  refreshKey: number;
  highlightClipId: string | null;
  onHighlightDone: () => void;
}) {
  const [clips, setClips] = useState<StoredClip[] | null>(null);

  const reload = () => getAllClips().then(setClips);

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    await deleteClip(id);
    reload();
  };

  if (clips === null) return <div className="empty">Loading…</div>;

  if (clips.length === 0) {
    return (
      <div className="empty">
        <div className="big">🎬</div>
        <div>No clips yet.</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Clips are captured automatically when the monster hears a loud noise.
        </div>
      </div>
    );
  }

  return (
    <div>
      {clips.map((c) => (
        <ClipRow
          key={c.id}
          clip={c}
          onDelete={handleDelete}
          highlight={c.id === highlightClipId}
          onHighlightDone={onHighlightDone}
        />
      ))}
    </div>
  );
}
