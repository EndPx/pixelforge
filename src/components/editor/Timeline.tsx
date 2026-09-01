import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store";
import { renderFrameToImageData } from "../../editor/render";
import type { Frame } from "../../types";

function FrameThumb({ frame, size }: { frame: Frame; size: { w: number; h: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.putImageData(renderFrameToImageData(frame, size.w, size.h, ctx), 0, 0);
  }, [frame, size.w, size.h]);

  return (
    <canvas
      ref={ref}
      className="h-10 w-10 rounded ring-1 ring-white/15"
      style={{
        imageRendering: "pixelated",
        background: "repeating-conic-gradient(#2a2d3a 0% 25%, #22242e 0% 50%) 50% / 8px 8px",
      }}
    />
  );
}

export function Timeline() {
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const store = useEditorStore;
  const [playing, setPlaying] = useState(false);
  const playIndexRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const s = store.getState();
      const idx = s.frames.findIndex((f) => f.id === s.activeFrameId);
      playIndexRef.current = (idx + 1) % s.frames.length;
      s.selectFrame(s.frames[playIndexRef.current].id);
    };
    const current = frames.find((f) => f.id === activeFrameId);
    const timer = setInterval(tick, Math.max(60, current?.duration ?? 300));
    return () => clearInterval(timer);
  }, [playing, frames, activeFrameId, store]);

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Timeline · {frames.length} frame{frames.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <button
            title={playing ? "Pause" : "Play animation"}
            onClick={() => setPlaying((p) => !p)}
            className={`rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 ${playing ? "text-sky-300" : ""}`}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            title="Duplicate frame"
            onClick={() => store.getState().duplicateFrame()}
            className="rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ⧉
          </button>
          <button
            title="Add empty frame"
            onClick={() => store.getState().createFrame()}
            className="rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex min-h-0 items-center gap-1.5 overflow-x-auto pb-1">
        {frames.map((frame, i) => {
          const active = frame.id === activeFrameId;
          return (
            <div key={frame.id} className="group relative">
              <button
                onClick={() => {
                  setPlaying(false);
                  store.getState().selectFrame(frame.id);
                }}
                className={`relative flex flex-col items-center gap-0.5 rounded-md p-1 ${
                  active ? "bg-sky-500/15 ring-1 ring-sky-400/60" : "hover:bg-zinc-800/70"
                }`}
              >
                <FrameThumb frame={frame} size={{ w: width, h: height }} />
                <span className={`text-[10px] ${active ? "text-sky-300" : "text-zinc-500"}`}>{i + 1}</span>
              </button>
              {frames.length > 1 && (
                <button
                  title="Delete frame"
                  onClick={() => store.getState().deleteFrame(frame.id)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[9px] text-zinc-300 hover:bg-red-500 hover:text-white group-hover:flex"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
