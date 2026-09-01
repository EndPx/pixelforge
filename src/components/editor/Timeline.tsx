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
      className="h-8 w-8 border border-edge2"
      style={{
        imageRendering: "pixelated",
        background: "repeating-conic-gradient(#3a3a41 0% 25%, #303036 0% 50%) 50% / 6px 6px",
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

  const activeIndex = frames.findIndex((f) => f.id === activeFrameId);

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

  const jump = (delta: number) => {
    if (frames.length === 0) return;
    const next = (activeIndex + delta + frames.length) % frames.length;
    setPlaying(false);
    store.getState().selectFrame(frames[next].id);
  };

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="pf-label">Frames</span>
          <div className="flex gap-0.5">
            <button title="First frame" onClick={() => jump(-activeIndex)} className="pf-btn h-5 w-5 p-0 text-[10px]">
              ⇤
            </button>
            <button title="Previous frame" onClick={() => jump(-1)} className="pf-btn h-5 w-5 p-0 text-[10px]">
              ◀
            </button>
            <button
              title={playing ? "Pause" : "Play"}
              onClick={() => setPlaying((p) => !p)}
              className={`pf-btn h-5 w-5 p-0 text-[10px] ${playing ? "is-on" : ""}`}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button title="Next frame" onClick={() => jump(1)} className="pf-btn h-5 w-5 p-0 text-[10px]">
              ▶
            </button>
            <button title="Last frame" onClick={() => jump(frames.length - 1 - activeIndex)} className="pf-btn h-5 w-5 p-0 text-[10px]">
              ⇥
            </button>
          </div>
        </div>
        <div className="flex gap-0.5">
          <button title="Duplicate frame" onClick={() => store.getState().duplicateFrame()} className="pf-btn h-5 w-5 p-0 text-xs">
            ⧉
          </button>
          <button title="Add empty frame" onClick={() => store.getState().createFrame()} className="pf-btn h-5 w-5 p-0 text-xs">
            +
          </button>
        </div>
      </div>
      <div className="flex min-h-0 items-stretch gap-px overflow-x-auto border border-edge bg-edge p-px">
        {frames.map((frame, i) => {
          const active = frame.id === activeFrameId;
          return (
            <div key={frame.id} className="group relative shrink-0">
              <button
                onClick={() => {
                  setPlaying(false);
                  store.getState().selectFrame(frame.id);
                }}
                className={`flex h-full flex-col items-center gap-0.5 px-1 py-0.5 ${
                  active ? "bg-accent-dim outline outline-1 outline-accent" : "bg-panel2 hover:bg-panel3"
                }`}
              >
                <FrameThumb frame={frame} size={{ w: width, h: height }} />
                <span className={`text-[10px] ${active ? "text-[#cfe6ff]" : "text-dim"}`}>{i + 1}</span>
              </button>
              {frames.length > 1 && (
                <button
                  title="Delete frame"
                  onClick={() => store.getState().deleteFrame(frame.id)}
                  className="absolute -right-1 -top-1 hidden h-3.5 w-3.5 items-center justify-center border border-edge2 bg-panel3 text-[8px] text-ink hover:border-red-500 hover:text-red-400 group-hover:flex"
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
